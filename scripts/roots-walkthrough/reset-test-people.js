/**
 * Nollställer bara allowlistade testkonton. Kräver --apply.
 * Lösen från FILM_PASSWORD. Skriver aldrig ut lösen eller URL.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, statePath } from "./config.js";
import { openDb } from "./db.js";
import { saveState } from "./state.js";

const require = createRequire(
  path.join(ROOT, "../../packages/db/package.json")
);
const { hash } = require("@node-rs/argon2");

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const TEST_ORG_NAMES = [
  "Roots FBK",
  "Demo Fotbollsklubb",
  "Demo IF Sundsvall",
];

const BLOCKED = new Set(["admin@roots.se", "salj@roots.se"]);

const FBK = {
  orgName: "Roots FBK",
  assocEmail: "walk.forening.mt7s7hmq@roots.nu",
  assocName: "Anna Andersson",
  leaderEmail: "walk.lag.mt7s7hmq@roots.nu",
  leaderName: "Erik Lindgren",
  sellerEmail: "walk.salj.mt7s7hmq@roots.nu",
  sellerName: "Maja Svensson",
  teamName: "P14 Blå",
  campaignName: "Vårkampanj 2026",
  internEmail: "walk.intern.mt7s7hmq@roots.nu",
  internName: "Walk Intern",
};

function allowlistUsers(sql) {
  return sql`
    SELECT u.id, u.email, u.role, o.name AS org_name
    FROM users u
    LEFT JOIN organizations o ON o.id = u.org_id
    WHERE
      u.email LIKE '%@film.roots.nu'
      OR u.email LIKE 'walk.%@roots.nu'
      OR u.email LIKE '%@demo.se'
      OR u.email LIKE '%@demo-if.se'
      OR o.name = ANY(${TEST_ORG_NAMES})
    ORDER BY u.email
  `;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const password = process.env.FILM_PASSWORD?.trim();
  if (apply && !password) {
    throw new Error("FILM_PASSWORD måste vara satt för --apply.");
  }

  const sql = openDb();
  try {
    const users = await allowlistUsers(sql);
    const blocked = users.filter((u) => BLOCKED.has(u.email));
    if (blocked.length) {
      throw new Error("Allowlist träffade spärrat konto. Avbrutet.");
    }
    if (users.length === 0) {
      throw new Error("Inga testkonton. Avbrutet.");
    }

    console.log(`Hittade ${users.length} testkonton.`);
    for (const u of users) {
      console.log(`  ${u.role} ${u.email} ${u.org_name || "-"}`);
    }

    if (!apply) {
      console.log("Torrkörning. Kör med --apply för att skriva.");
      return;
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);
    const ids = users.map((u) => u.id);
    const updated = await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ANY(${ids})
      RETURNING email
    `;
    console.log(`Satte hash på ${updated.length} konton.`);

    const [org] = await sql`
      SELECT id FROM organizations WHERE name = ${FBK.orgName} LIMIT 1
    `;
    if (!org) throw new Error("Hittar inte Roots FBK.");

    const [intern] = await sql`
      SELECT id, role FROM users WHERE email = ${FBK.internEmail} LIMIT 1
    `;
    if (intern && intern.role !== "INTERNAL_ADMIN") {
      throw new Error("Test-intern har fel roll. Avbrutet.");
    }
    if (intern) {
      await sql`
        UPDATE users
        SET password_hash = ${passwordHash},
            contact_name = ${FBK.internName},
            org_id = ${org.id},
            mfa_secret = NULL,
            mfa_enabled_at = NULL,
            mfa_backup_codes = NULL,
            updated_at = NOW()
        WHERE id = ${intern.id}
          AND email = ${FBK.internEmail}
          AND role = 'INTERNAL_ADMIN'
      `;
    } else {
      await sql`
        INSERT INTO users (email, password_hash, role, org_id, contact_name)
        VALUES (
          ${FBK.internEmail},
          ${passwordHash},
          'INTERNAL_ADMIN',
          ${org.id},
          ${FBK.internName}
        )
      `;
    }
    console.log(`Test-intern redo: ${FBK.internEmail}`);

    await sql`
      UPDATE organizations
      SET verified = true, verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
      WHERE id = ${org.id}
    `;

    const [campaign] = await sql`
      SELECT id FROM campaigns WHERE org_id = ${org.id} ORDER BY created_at DESC LIMIT 1
    `;
    if (!campaign) throw new Error("Saknar kampanj på Roots FBK.");

    await sql`
      UPDATE campaigns
      SET start_date = CURRENT_DATE - 18,
          end_date = CURRENT_DATE + 12,
          status = 'ACTIVE',
          margin_percent = 35,
          updated_at = NOW()
      WHERE id = ${campaign.id}
    `;

    const catalog = await sql`
      SELECT id FROM products WHERE active = true ORDER BY price_ore DESC
    `;
    for (let i = 0; i < catalog.length; i++) {
      await sql`
        INSERT INTO campaign_products (campaign_id, product_id, sort_order, active)
        VALUES (${campaign.id}, ${catalog[i].id}, ${i}, true)
        ON CONFLICT (campaign_id, product_id) DO UPDATE SET active = true
      `;
    }

    const [team] = await sql`
      SELECT id FROM teams WHERE org_id = ${org.id} ORDER BY created_at DESC LIMIT 1
    `;
    const [seller] = await sql`
      SELECT id, shop_slug FROM sellers
      WHERE team_id = ${team?.id || null}
      LIMIT 1
    `;
    if (!team || !seller) throw new Error("Saknar lag eller säljare på Roots FBK.");

    await sql`
      UPDATE sellers SET individual_goal = 12000, updated_at = NOW()
      WHERE id = ${seller.id}
    `;

    const existingGoal = await sql`
      SELECT id FROM team_goals
      WHERE team_id = ${team.id} AND campaign_id = ${campaign.id}
      LIMIT 1
    `;
    if (existingGoal.length) {
      await sql`
        UPDATE team_goals SET goal_value = 18000 WHERE id = ${existingGoal[0].id}
      `;
    } else {
      await sql`
        INSERT INTO team_goals (team_id, campaign_id, goal_type, goal_value)
        VALUES (${team.id}, ${campaign.id}, 'AMOUNT', 18000)
      `;
    }

    await sql`
      DELETE FROM customer_order_lines
      WHERE order_id IN (
        SELECT id FROM customer_orders
        WHERE org_id = ${org.id} AND customer_email LIKE '%@film.roots.nu'
      )
    `;
    const deleted = await sql`
      DELETE FROM customer_orders
      WHERE org_id = ${org.id} AND customer_email LIKE '%@film.roots.nu'
      RETURNING id
    `;
    console.log(`Tog bort ${deleted.length} filmordrar.`);

    const dir = path.dirname(statePath("sv"));
    fs.mkdirSync(dir, { recursive: true });
    saveState({
      stamp: "mt7s7hmq",
      orgName: FBK.orgName,
      assocEmail: FBK.assocEmail,
      assocName: FBK.assocName,
      leaderEmail: FBK.leaderEmail,
      leaderName: FBK.leaderName,
      sellerEmail: FBK.sellerEmail,
      sellerName: FBK.sellerName,
      teamName: FBK.teamName,
      campaignName: FBK.campaignName,
      shopSlug: seller.shop_slug,
      internEmail: FBK.internEmail,
      internName: FBK.internName,
    });
    console.log(`Roots FBK redo. shop=${seller.shop_slug}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
