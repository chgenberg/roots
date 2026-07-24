#!/usr/bin/env node
/**
 * Screenshot-rigg för hela Roots-sajten.
 *
 * Går igenom varje användarvänd sida (publik + alla inloggade roller), tar
 * screenshot i desktop och mobil, och loggar samtidigt console-fel,
 * page-errors och misslyckade nätverksanrop per sida.
 *
 * Kör:  node scripts/roots-shots/shoot.mjs
 *       node scripts/roots-shots/shoot.mjs --only=start,forening-dashboard
 *       node scripts/roots-shots/shoot.mjs --viewport=mobile
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PAGES, ACCOUNTS, PASSWORD } from "./pages.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "out");
const BASE = (process.env.BASE_URL || "http://localhost:3004").replace(/\/$/, "");

const args = process.argv.slice(2);
const argVal = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};
const only = argVal("only", "").split(",").filter(Boolean);
const wantViewports = argVal("viewport", "desktop,mobile").split(",");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, isMobile: false },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

// Dynamiska värden i sökvägar.
const VARS = {
  sellerSlug: process.env.SHOT_SELLER_SLUG || "demo-noah",
  calcToken: process.env.SHOT_CALC_TOKEN || "demo-kalkyl",
};
const resolvePath = (p) => p.replace(/:(\w+)/g, (_, k) => VARS[k] ?? `:${k}`);

/** Döljer dev-overlays och annat som inte hör hemma i en designgranskning. */
const HIDE_CHROME = `
  nextjs-portal,[data-next-badge-root],[data-nextjs-toast]{display:none!important}
`;

const report = [];

async function newContext(browser, vpName) {
  const vp = VIEWPORTS[vpName];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.deviceScaleFactor || 2,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    reducedMotion: "reduce",
  });
  // Ingen cookie-banner i bilderna.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("cookie_consent", "all");
      localStorage.setItem("roots_cookie_consent", "all");
    } catch {}
  });
  return ctx;
}

/**
 * Loggar in via det riktiga formuläret.
 *
 * Fälten är React-kontrollerade: fyller vi i dem innan hydreringen är klar
 * skriver React tillbaka tomma värden, och då blockerar `required` submit helt
 * tyst (ingen request, inget felmeddelande). Vi fyller därför i och verifierar
 * att värdet ligger kvar innan vi klickar.
 */
async function login(page, accountKey) {
  const { email } = ACCOUNTS[accountKey];
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 40000 });

  const emailField = page.locator('input[type="email"]');
  const pwField = page.locator('input[type="password"]');
  await emailField.waitFor({ state: "visible", timeout: 15000 });

  let filled = false;
  for (let attempt = 0; attempt < 6 && !filled; attempt++) {
    await page.waitForTimeout(500);
    await emailField.fill(email);
    await pwField.fill(PASSWORD);
    filled =
      (await emailField.inputValue()) === email &&
      (await pwField.inputValue()) === PASSWORD;
  }
  if (!filled) {
    console.warn(`   ⚠ kunde inte fylla i formuläret för ${accountKey}`);
    return false;
  }

  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);

  const ok = !new URL(page.url()).pathname.startsWith("/login");
  if (!ok) {
    const msg = await page
      .locator('[role="alert"], .text-destructive, p.text-sm')
      .first()
      .innerText()
      .catch(() => "");
    console.warn(
      `   ⚠ inloggning misslyckades för ${accountKey} (${email})${msg ? ` — "${msg.trim().slice(0, 120)}"` : ""}`
    );
  }
  return ok;
}

async function shoot(page, entry, vpName) {
  const url = `${BASE}${resolvePath(entry.path)}`;
  const errors = [];
  const netFails = [];

  const onConsole = (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  };
  const onPageErr = (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 300)}`);
  const onResp = (r) => {
    const s = r.status();
    if (s >= 400 && !r.url().includes("/_next/")) {
      netFails.push(`${s} ${r.url().replace(BASE, "").slice(0, 160)}`);
    }
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  page.on("response", onResp);

  let status = "ok";
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    if (resp && resp.status() >= 400 && entry.name !== "404") status = `http-${resp.status()}`;
    await page.addStyleTag({ content: HIDE_CHROME }).catch(() => {});
    // Vänta in typsnitt + låt data/skeletons landa (dashboards pollar → aldrig networkidle).
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(2600);
    await page.evaluate(() => window.scrollTo(0, 0));
    const dir = path.join(OUT, vpName);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, `${entry.name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  } catch (e) {
    status = `FAIL: ${String(e.message || e).slice(0, 160)}`;
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageErr);
  page.off("response", onResp);

  report.push({
    name: entry.name,
    path: resolvePath(entry.path),
    auth: entry.auth || "publik",
    viewport: vpName,
    status,
    errors: [...new Set(errors)],
    netFails: [...new Set(netFails)],
  });
  const flag =
    status !== "ok" ? "✖" : errors.length || netFails.length ? "⚠" : "✓";
  console.log(`   ${flag} ${entry.name} (${status})`);
}

const selected = PAGES.filter((p) => !only.length || only.includes(p.name));

// Gruppera per auth så vi loggar in en gång per roll.
const groups = new Map();
for (const p of selected) {
  const k = p.auth || "__public__";
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(p);
}

const browser = await chromium.launch();
for (const vpName of wantViewports) {
  if (!VIEWPORTS[vpName]) continue;
  console.log(`\n══ ${vpName.toUpperCase()} ══`);
  for (const [authKey, entries] of groups) {
    const label = authKey === "__public__" ? "Publik" : ACCOUNTS[authKey].label;
    console.log(`\n▸ ${label} (${entries.length} sidor)`);
    const ctx = await newContext(browser, vpName);
    const page = await ctx.newPage();
    if (authKey !== "__public__") {
      const ok = await login(page, authKey);
      if (!ok) {
        for (const e of entries) {
          report.push({
            name: e.name, path: e.path, auth: authKey, viewport: vpName,
            status: "SKIP: login failed", errors: [], netFails: [],
          });
        }
        await ctx.close();
        continue;
      }
    }
    for (const e of entries) await shoot(page, e, vpName);
    await ctx.close();
  }
}
await browser.close();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

// ── Sammanfattning ────────────────────────────────────────────────────
const bad = report.filter((r) => r.status !== "ok");
const noisy = report.filter((r) => r.status === "ok" && (r.errors.length || r.netFails.length));
console.log(`\n══ SAMMANFATTNING ══`);
console.log(`Totalt: ${report.length} sidvisningar`);
console.log(`Trasiga: ${bad.length}`);
console.log(`Med fel i konsol/nätverk: ${noisy.length}`);
for (const r of bad) console.log(`  ✖ [${r.viewport}] ${r.name} → ${r.status}`);
for (const r of noisy) {
  console.log(`  ⚠ [${r.viewport}] ${r.name}`);
  for (const e of r.errors.slice(0, 3)) console.log(`      console: ${e}`);
  for (const n of r.netFails.slice(0, 3)) console.log(`      net: ${n}`);
}
console.log(`\nBilder: ${OUT}/<viewport>/*.png`);
console.log(`Rapport: ${OUT}/report.json`);
