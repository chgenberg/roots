/**
 * Kontrollerar att portalens sidor säger till när datahämtningen faller.
 *
 * Engångsskript. Blockerar alla anrop till API:t på nätverksnivå och går
 * igenom varje portalsida som tidigare svalde felet med `.catch(() => {})`
 * och renderade en tom lista eller nollställda belopp.
 *
 * Kör med web på 3004 och API på 3011 mot en demo-seedad databas:
 *   node scripts/check-portal-errors.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL || "http://localhost:3004";
const OUT = "/tmp/roots-portal-errors";
mkdirSync(OUT, { recursive: true });

// admin@roots.se ser både klubb-, sälj- och adminytor.
const EMAIL = "admin@roots.se";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";

const PAGES = [
  { path: "/portal", name: "översikt" },
  { path: "/portal/bestallningar", name: "beställningar" },
  { path: "/portal/intakter", name: "intäkter" },
  { path: "/portal/klubbar", name: "klubbar" },
  { path: "/portal/medlemmar", name: "medlemmar" },
  { path: "/portal/offerter", name: "offerter" },
  { path: "/portal/system", name: "system" },
  { path: "/portal/fakturor", name: "fakturor" },
];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FEL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });

try {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  for (let i = 0; i < 10; i++) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.waitForTimeout(400);
    if ((await page.inputValue('input[type="email"]')) === EMAIL) break;
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 25000,
  });
  check("inloggning", true, page.url());

  // Nu bryter vi datahämtningen. Sessionskontrollen sker server-side i
  // middleware, så den påverkas inte — bara sidornas egna anrop.
  await page.route("**/v1/portal/**", (route) => route.abort("failed"));

  for (const { path, name } of PAGES) {
    await page.goto(`${WEB}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);

    const alert = page.locator('[role="alert"]');
    const visible = (await alert.count()) > 0 && (await alert.first().isVisible());
    const text = visible
      ? (await alert.first().innerText()).replace(/\s+/g, " ").slice(0, 90)
      : "";
    check(`${name} visar ett felläge`, visible, text);

    if (visible) {
      const retry = alert
        .first()
        .getByRole("button", { name: /Försök igen/i });
      check(
        `${name} erbjuder ett nytt försök`,
        (await retry.count()) > 0 && (await retry.first().isVisible())
      );
    }

    await page.screenshot({
      path: `${OUT}/${name.replace(/[^a-zåäö]/gi, "")}.png`,
      fullPage: true,
    });
  }
} catch (err) {
  check("skriptet kördes utan undantag", false, String(err).slice(0, 300));
  await page
    .screenshot({ path: `${OUT}/99-fel.png`, fullPage: true })
    .catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} kontroller OK. Bilder i ${OUT}`
);
process.exit(failed.length === 0 ? 0 : 1);
