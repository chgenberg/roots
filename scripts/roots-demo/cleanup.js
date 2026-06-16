// Best-effort DB-rensning så tagningar är 100% reproducerbara.
// Tar bort data som flödena skapar (manuella ordrar, lag-broadcast,
// demofilm-kampanj). Kräver `pg` + nåbar DATABASE_URL — annars hoppas
// den tyst över (filmen kan ändå spelas in, men data ackumuleras).
import {
  DATABASE_URL,
  REC_CAMPAIGN_NAME,
  REC_CHAT_BODY,
  REC_ORDER_CUSTOMER,
  REC_CALC_TOKEN,
  REC_CALC_ASSOCIATION,
} from "./config.js";

// Presets för demo-kalkylatorlänken (matchar CALCULATOR_DEFAULTS i contracts;
// inlinas här så scriptet slipper bygg-beroende mot @roots/contracts).
const CALC_PRESETS = { sellers: 25, avgPerSellerKr: 1500, marginPercent: 35 };

// Töm login-rate-limit-nycklar i Redis så upprepade tagningar inte fastnar
// på "För många inloggningsförsök" (rl:login:{ip}:{email}, 5/15 min). Best
// effort via redis-cli — hoppas tyst över om det inte finns.
export async function clearLoginRateLimit() {
  try {
    const { execSync } = await import("node:child_process");
    const keys = execSync(`redis-cli --scan --pattern 'rl:login:*'`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (keys.length) {
      execSync(`redis-cli del ${keys.join(" ")}`, { stdio: "ignore" });
      console.log(`  · rensade ${keys.length} login-rate-limit-nycklar`);
    }
  } catch {
    // redis-cli saknas eller Redis ej nåbar — strunt i det.
  }
}

export async function cleanupRecordingData() {
  await clearLoginRateLimit();
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.log("  · pg ej installerat — hoppar över DB-rensning");
    return;
  }

  const { Client } = pg.default || pg;
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
  } catch (e) {
    console.log(`  · DB ej nåbar (${e.message}) — hoppar över rensning`);
    return;
  }

  const run = async (label, sql, params) => {
    try {
      const res = await client.query(sql, params);
      if (res.rowCount) console.log(`  · rensade ${res.rowCount} (${label})`);
    } catch (e) {
      console.warn(`  ⚠ rensning "${label}" misslyckades: ${e.message}`);
    }
  };

  // Lag-broadcast från chatt-flödet.
  await run("team_messages", `DELETE FROM team_messages WHERE body = $1`, [
    REC_CHAT_BODY,
  ]);

  // Manuell order från säljar-flödet (rader först pga FK).
  await run(
    "order_lines",
    `DELETE FROM customer_order_lines WHERE order_id IN (
       SELECT id FROM customer_orders WHERE is_manual = true AND customer_name = $1
     )`,
    [REC_ORDER_CUSTOMER]
  );
  await run(
    "customer_orders",
    `DELETE FROM customer_orders WHERE is_manual = true AND customer_name = $1`,
    [REC_ORDER_CUSTOMER]
  );

  // Demofilm-kampanj från förenings-flödet.
  await run("campaigns", `DELETE FROM campaigns WHERE name = $1`, [
    REC_CAMPAIGN_NAME,
  ]);

  // Säkerställ att den fristående kalkylator-länken (/kalkylator/demo-if)
  // finns så räknesnurrefilmen kan spelas in mot en ren, isolerad sida.
  // Idempotent: ägaren sätts till tidigaste interna/sälj-användaren.
  await run(
    "calculator_link",
    `INSERT INTO calculator_links (token, created_by_user_id, association_name, presets)
       SELECT $1, u.id, $2, $3::jsonb
       FROM users u
       WHERE u.role IN ('INTERNAL_ADMIN','SALES_ADMIN','SALES_REP')
       ORDER BY u.created_at ASC
       LIMIT 1
     ON CONFLICT (token) DO UPDATE
       SET association_name = EXCLUDED.association_name,
           presets = EXCLUDED.presets`,
    [REC_CALC_TOKEN, REC_CALC_ASSOCIATION, JSON.stringify(CALC_PRESETS)]
  );

  await client.end().catch(() => {});
}
