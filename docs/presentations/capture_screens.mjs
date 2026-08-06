/**
 * Fotograferar plattformens vyer till plattformspresentationen.
 *
 * Bilderna hamnar i docs/presentations/_assets/skarm/ och bäddas sedan in av
 * deck_plattform.py. Kör mot den lokala dev-servern med demodata, eftersom
 * produktion ligger bakom förhandsvisningsgrinden och dessutom saknar de
 * seedade siffror som gör vyerna begripliga i en presentation.
 *
 * Förutsätter att /tmp/roots-ui.env är laddad och att båda dev-servrarna kör:
 *   source /tmp/roots-ui.env && cd apps/api && pnpm dev
 *   source /tmp/roots-ui.env && cd apps/web && pnpm dev
 *
 * Kör:  node docs/presentations/capture_screens.mjs [namn ...]
 */

import { mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "_assets", "skarm");
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3004";
/**
 * Alla konton vi fotograferar finns i databasen, och seed-demo hashar
 * "Demo1234!". Genvägskontona i auth.ts (som lyder under ROOTS_DEMO_PASSWORD)
 * används bara när e-posten saknas i databasen, så de rör oss inte.
 */
const PASSWORD = "Demo1234!";

async function loadPlaywright() {
  const store = join(HERE, "..", "..", "node_modules", ".pnpm");
  const dir = (await readdir(store)).find((d) => d.startsWith("playwright@"));
  if (!dir) throw new Error("playwright saknas — kör pnpm install i roten.");
  return import(join(store, dir, "node_modules/playwright/index.mjs"));
}

/** Skärmens mått i presentationen: bred vy respektive telefon. */
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 414, height: 896 };

const SHOTS = [
  // ── Publikt: det föreningen och supportern möter ──────────────────
  { name: "publik-start", url: "/", vp: DESKTOP },
  { name: "publik-foreningsliv", url: "/foreningsliv", vp: DESKTOP },
  { name: "publik-produkter", url: "/produkter", vp: DESKTOP },
  { name: "publik-produkt", url: "/produkter/shampoo", vp: DESKTOP },
  { name: "publik-sa-fungerar", url: "/sa-fungerar-det", vp: DESKTOP },

  // ── Säljarens egna verktyg ────────────────────────────────────────
  { name: "portal-oversikt", url: "/portal", as: "salj@roots.se", vp: DESKTOP },
  { name: "portal-pipeline", url: "/portal/pipeline", as: "salj@roots.se", vp: DESKTOP },
  { name: "portal-raknesnurra", url: "/portal/raknesnurra", as: "salj@roots.se", vp: DESKTOP },
  { name: "portal-offerter", url: "/portal/offerter", as: "salj@roots.se", vp: DESKTOP },
  { name: "portal-statistik", url: "/portal/statistik", as: "salj@roots.se", vp: DESKTOP },

  // ── Föreningens vy ────────────────────────────────────────────────
  { name: "forening-oversikt", url: "/forening", as: "forening@demo-if.se", vp: DESKTOP },
  { name: "forening-lag", url: "/forening/lag", as: "forening@demo-if.se", vp: DESKTOP },
  { name: "forening-statistik", url: "/forening/statistik", as: "forening@demo-if.se", vp: DESKTOP },
  { name: "forening-avrakning", url: "/forening/avrakning", as: "forening@demo-if.se", vp: DESKTOP },

  // ── Lagledarens vy ────────────────────────────────────────────────
  { name: "lag-oversikt", url: "/lag", as: "lag@demo-if.se", vp: DESKTOP },
  { name: "lag-saljare", url: "/lag/saljare", as: "lag@demo-if.se", vp: DESKTOP },

  // ── Säljarens telefon ─────────────────────────────────────────────
  { name: "minshop-start", url: "/min-shop", as: "leo.assoc@demo-if.se", vp: PHONE },
  { name: "minshop-statistik", url: "/min-shop/statistik", as: "leo.assoc@demo-if.se", vp: PHONE },

  // ── Supporterns köp ───────────────────────────────────────────────
  { name: "shop-start", url: "/shop/demo-assoc-leo", vp: PHONE },
  { name: "shop-kassa", url: "/shop/demo-assoc-leo/kassa", vp: PHONE },
];

const { chromium } = await loadPlaywright();
await mkdir(OUT, { recursive: true });

const wanted = process.argv.slice(2);
const queue = wanted.length
  ? SHOTS.filter((s) => wanted.includes(s.name))
  : SHOTS;

const browser = await chromium.launch();
/** En kontext per roll, så att inloggningen bara görs en gång. */
const contexts = new Map();

async function contextFor(as, vp) {
  const key = `${as ?? "anon"}@${vp.width}`;
  if (contexts.has(key)) return contexts.get(key);

  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 2,
    locale: "sv-SE",
    isMobile: vp.width < 600,
    hasTouch: vp.width < 600,
  });
  if (as) {
    const p = await ctx.newPage();
    // networkidle, inte domcontentloaded: formuläret är en klientkomponent och
    // ett klick före hydreringen gör ingenting alls — inget anrop når API:t.
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p.fill("#email", as);
    await p.fill("#password", PASSWORD);
    await p.click('button[type="submit"]');
    try {
      await p.waitForURL((u) => !u.pathname.includes("/login"), {
        timeout: 20000,
      });
    } catch {
      const msg = await p
        .locator("form")
        .innerText()
        .catch(() => "");
      throw new Error(
        `inloggning misslyckades för ${as}: ${msg.replace(/\n+/g, " · ").slice(0, 120)}`
      );
    }
    await p.close();
  }
  contexts.set(key, ctx);
  return ctx;
}

const failures = [];

for (const shot of queue) {
  try {
    const ctx = await contextFor(shot.as, shot.vp);
    const page = await ctx.newPage();
    await page.goto(BASE + shot.url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    // Bort med allt som stör bilden: chattbubblan, cookie-rutan, kvarvarande
    // laddningsskelett.
    await page.addStyleTag({
      content: `
        [data-chat-widget], [aria-label*="chatt" i], [data-cookie-banner],
        [class*="animate-pulse"] { visibility: hidden !important; }
        *, *::before, *::after { animation-duration: 0s !important;
          transition-duration: 0s !important; }
      `,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `${shot.name}.png`) });
    const title = await page.title();
    console.log(`✓ ${shot.name.padEnd(22)} ${shot.url}   ${title.slice(0, 46)}`);
    await page.close();
  } catch (err) {
    failures.push(`${shot.name}: ${err.message.split("\n")[0]}`);
    console.log(`✗ ${shot.name.padEnd(22)} ${err.message.split("\n")[0]}`);
  }
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} misslyckades:`);
  for (const f of failures) console.log("  " + f);
  process.exitCode = 1;
}
