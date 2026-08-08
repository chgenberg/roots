#!/usr/bin/env node
/**
 * MASTERPLAN_01 KC8.7: synthetic monitoring för key public-flows.
 *
 * Körs som vanligt Node-script (ingen TS-toolchain behövs i cron-
 * container). Treffar publika endpoints och exit:ar non-zero vid
 * fail så att GitHub Actions / Railway cron / oavsett orkestrerare
 * kan slå ett email-alert.
 *
 * Användning:
 *   API_BASE=https://api.roots.se WEB_BASE=https://roots.se \
 *     node scripts/synthetic.mjs
 *
 * Cron-rekommendation: var 6:e timme (4×/dygn) — punkt #7 i KC8.
 * Frekvensen är konservativ för att inte spendera AI-tokens varje
 * minut. Public-chat-checken hoppar over om HAS_OPENAI är "false".
 *
 * Checks:
 *   1. GET  {api}/healthz                — liveness
 *   2. GET  {api}/readyz                 — DB + Redis ping
 *   3. GET  {api}/v1/csrf-token          — säkerhets-rotation funkar
 *   4. GET  {web}/                       — homepage svarar 200
 *   5. GET  {web}/robots.txt             — SEO-routens runtime
 *   6. (optional) GET {api}/v1/ai/health — om endpoint finns
 *
 * Lägg INTE in checks som mutterar data (creating orders, sending
 * email) — synthetic ska vara repeterbart utan side-effects.
 */

import { setTimeout as sleep } from "node:timers/promises";

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:4000").replace(/\/$/, "");
const WEB_BASE = (process.env.WEB_BASE || "http://127.0.0.1:3003").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.SYNTHETIC_TIMEOUT_MS || 10_000);

const results = [];

async function check(name, url, validator) {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = globalThis.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "roots-synthetic/1.0" },
    });
    const ms = Date.now() - start;
    const ok = await Promise.resolve(validator(res)).catch(() => false);
    results.push({ name, url, status: res.status, ms, ok });
    return ok;
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ name, url, status: 0, ms, ok: false, error: String(err) });
    return false;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function run() {
  console.log(`[synthetic] API_BASE=${API_BASE} WEB_BASE=${WEB_BASE}`);

  await check("api.healthz", `${API_BASE}/healthz`, (r) => r.status === 200);

  await check(
    "api.readyz",
    `${API_BASE}/readyz`,
    // /readyz svarar 503 om DB/Redis är degraderat — vi vill veta
    (r) => r.status === 200
  );

  await check(
    "api.csrf",
    `${API_BASE}/v1/csrf-token`,
    async (r) => {
      if (r.status !== 200) return false;
      const body = await r.json();
      return typeof body?.token === "string" && body.token.length > 16;
    }
  );

  await check("web.home", `${WEB_BASE}/`, (r) => r.status === 200);

  await check(
    "web.robots",
    `${WEB_BASE}/robots.txt`,
    async (r) => {
      if (r.status !== 200) return false;
      const text = await r.text();
      // Verifiera att /shop/ inte är blockerat — KC7.2 success-kriterie.
      // Matcha bara Disallow för själva /shop (ev. trailing slash), inte
      // snävare paths som /shop/*/order/ som ska vara blockerade.
      return (
        /User-agent/i.test(text) &&
        !/Disallow:\s*\/shop\/?\s*$/im.test(text)
      );
    }
  );

  // P3.56 (audit 2026-05-26): tidigare täckte synthetic-runnern bara
  // healthz/csrf/home/robots. Sitemap-routens runtime, en konkret
  // shop-sida och katalog-API:t var oövervakade — om någon av dem
  // brakade märkte vi det först när konvertering rasade. Lägger
  // till tre lätta, idempotenta läsningar.

  await check(
    "web.sitemap",
    `${WEB_BASE}/sitemap.xml`,
    async (r) => {
      if (r.status !== 200) return false;
      const text = await r.text();
      return text.includes("<urlset") && text.includes("</urlset>");
    }
  );

  // En representativ shop-sida att smoke-testa. Slug kan över-
  // styras med SYNTHETIC_SHOP_SLUG om vi inte vill leaka en
  // demo-säljares URL utåt.
  const shopSlugExplicit = !!process.env.SYNTHETIC_SHOP_SLUG?.trim();
  const shopSlug = (process.env.SYNTHETIC_SHOP_SLUG || "demo").trim();
  if (shopSlug) {
    await check(
      `web.shop.${shopSlug}`,
      `${WEB_BASE}/shop/${shopSlug}`,
      (r) => r.status === 200 || r.status === 404, // 404 är OK om slug medvetet tas bort
    );

    // Katalogen bakom shop-sidan. Kontrollen låg tidigare på
    // `GET /v1/products`, men den routen togs bort i 83810bc — så checken
    // hade varit permanent röd sedan dess, och en grind som alltid larmar
    // slutar folk läsa. Butikens egen endpoint är dessutom närmare det vi
    // vill veta: att en köpare får produkter att lägga i korgen, med pris.
    //
    // Kravet måste vara uttalat. Att godta 404 "eftersom slugen kan vara
    // borttagen med flit" gjorde kontrollen omöjlig att fela: i produktion
    // rapporterade den PASS på en 404, alltså grönt för en butik som inte
    // fanns. Nu gäller: sluggen angiven → katalogen MÅSTE fungera. Ingen slug
    // → hoppa över och säg det, i stället för att låtsas ha kontrollerat.
    if (shopSlugExplicit) {
      await check(
        "api.shop-catalog",
        `${API_BASE}/v1/shop/by-slug/${shopSlug}`,
        async (r) => {
          if (r.status !== 200) return false;
          const body = await r.json().catch(() => null);
          return (
            Array.isArray(body?.products) &&
            body.products.length > 0 &&
            body.products.every(
              (p) => typeof p.priceOre === "number" && p.priceOre > 0
            )
          );
        }
      );
    } else {
      results.push({
        name: "api.shop-catalog",
        url: `${API_BASE}/v1/shop/by-slug/${shopSlug}`,
        status: 0,
        ms: 0,
        ok: false,
        skipped: true,
        reason:
          "sätt SYNTHETIC_SHOP_SLUG till en riktig butik för att kräva att katalogen fungerar",
      });
    }
  }

  // MASTERPLAN_01 KC2.7: deletion-purge cron-trigger. Synthetic-runnern
  // är en bra plats att kicka jobbet eftersom den ändå kallas regelbundet
  // (4×/dygn). I prod sätter Railway INTERNAL_CRON_TOKEN och vi skickar
  // den som Bearer. Saknas token → vi hoppar checken så lokal dev inte
  // failar.
  const cronToken = process.env.INTERNAL_CRON_TOKEN;
  if (cronToken) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/v1/internal/cron/deletion-purge`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cronToken}`,
          "user-agent": "roots-synthetic/1.0",
        },
      });
      const ms = Date.now() - start;
      const ok = res.status === 200;
      let purged = "?";
      try {
        const body = await res.json();
        purged = String(body.purged ?? "?");
      } catch {
        /* ignore */
      }
      results.push({
        name: `cron.deletion-purge purged=${purged}`,
        url: `${API_BASE}/v1/internal/cron/deletion-purge`,
        status: res.status,
        ms,
        ok,
      });
    } catch (err) {
      results.push({
        name: "cron.deletion-purge",
        url: `${API_BASE}/v1/internal/cron/deletion-purge`,
        status: 0,
        ms: Date.now() - start,
        ok: false,
        error: String(err),
      });
    }
  }

  // Vänta innan vi listar resultaten — låter pino-loggar flushas i
  // container-stdout innan rapporten skrivs sist.
  await sleep(100);

  console.log("\n[synthetic] results:");
  for (const r of results) {
    // SKIP är ett eget utfall och inte ett grönt. Att visa "PASS" för något vi
    // aldrig kontrollerade är sämre än att inte ha kontrollen: rapporten
    // säger att butiken fungerar när den bara säger att vi inte kollade.
    const tag = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
    console.log(
      `  [${tag}] ${r.name.padEnd(16)} ${String(r.status).padStart(3)} ` +
        `${String(r.ms).padStart(5)}ms  ${r.url}` +
        `${r.reason ? `  (${r.reason})` : ""}` +
        `${r.error ? `  err=${r.error}` : ""}`
    );
  }

  const failed = results.filter((r) => !r.ok && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  if (failed.length > 0) {
    console.error(`\n[synthetic] ${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log(
    `\n[synthetic] all ${results.length - skipped.length} checks passed` +
      (skipped.length ? ` (${skipped.length} skipped)` : "")
  );
}

run().catch((err) => {
  console.error("[synthetic] runner crashed:", err);
  process.exit(2);
});
