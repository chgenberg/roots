/**
 * Går igenom portalen och fundraising-vyerna i mörkt läge.
 *
 * Engångsskript. Loggar in en gång per roll (loginspärren slår till om man
 * gör det per sida), tvingar på `dark` på <html> och letar efter det som
 * faktiskt gör mörkt läge oanvändbart: text vars kontrast mot sin egen
 * bakgrund understiger WCAG AA — 4.5:1 för brödtext, 3:1 för stor text.
 *
 * Kör med web på 3004 och API på 3011 mot en demo-seedad databas:
 *   node scripts/check-dark-mode.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL || "http://localhost:3004";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const OUT = "/tmp/roots-dark";
mkdirSync(OUT, { recursive: true });

const BY_ROLE = [
  {
    email: "admin@roots.se",
    routes: [
      ["/portal", "portal-oversikt"],
      ["/portal/bestallningar", "portal-bestallningar"],
      ["/portal/klubbar", "portal-klubbar"],
      ["/portal/produkter", "portal-produkter"],
      ["/portal/intakter", "portal-intakter"],
      ["/portal/medlemmar", "portal-medlemmar"],
      ["/portal/system", "portal-system"],
    ],
  },
  {
    email: "lag@demo-if.se",
    routes: [
      ["/lag", "lag-oversikt"],
      ["/lag/bestallningar", "lag-bestallningar"],
      ["/lag/avrakning", "lag-avrakning"],
      ["/lag/saljare", "lag-saljare"],
    ],
  },
  {
    email: "forening@demo-if.se",
    routes: [
      ["/forening", "forening-oversikt"],
      ["/forening/lag", "forening-lag"],
      ["/forening/mal", "forening-mal"],
      ["/forening/kalender", "forening-kalender"],
      ["/forening/avrakning", "forening-avrakning"],
      ["/forening/statistik", "forening-statistik"],
    ],
  },
  {
    email: "leo.assoc@demo-if.se",
    routes: [
      ["/min-shop", "saljare-oversikt"],
      ["/min-shop/bestallningar", "saljare-bestallningar"],
    ],
  },
];

function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
/**
 * Stora stegsiffror ("01"–"04" på /foreningsliv) är avsiktliga
 * vattenstämplar: de ligger på 1,35:1 i ljust läge också, och stegordningen
 * framgår av rubriken intill. Rent dekorativ text omfattas inte av WCAG:s
 * kontrastkrav, så vi räknar dem inte som fel.
 */
function isDecorativeWatermark(s) {
  return /^\d{1,2}$/.test(s.text) && s.size >= 40 && /text-brand-200/.test(s.cls);
}

function parseRgb(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || "");
  if (!m) return null;
  const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (parts.length >= 4 && parts[3] === 0) return null;
  return parts.slice(0, 3);
}

/** WCAG AA: 4.5:1 för brödtext, 3:1 för stor text (>=24px, eller >=18.66px fet). */
function contrastFailures(samples) {
  const bad = [];
  for (const s of samples) {
    if (isDecorativeWatermark(s)) continue;
    const fg = parseRgb(s.color);
    const bg = parseRgb(s.bg);
    if (!fg || !bg) continue;
    const large =
      s.size >= 24 || (s.size >= 18.66 && parseInt(s.weight, 10) >= 700);
    const need = large ? 3 : 4.5;
    const ratio = contrast(fg, bg);
    if (ratio < need) bad.push({ ...s, ratio: +ratio.toFixed(2), need });
  }
  return bad;
}

const COLLECT = () => {
  function paintedBg(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      const m = /rgba?\(([^)]+)\)/.exec(bg);
      if (m) {
        const p = m[1].split(",").map((v) => parseFloat(v.trim()));
        if (!(p.length >= 4 && p[3] < 0.5)) return bg;
      }
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }

  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) < 0.5) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    out.push({
      text: text.slice(0, 50),
      color: cs.color,
      bg: paintedBg(el),
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      cls: (el.className || "").toString().slice(0, 110),
    });
  }
  return out;
};

// Publika vyer behöver ingen inloggning. De ligger med här eftersom
// header, footer och orderbekräftelsens stegindikator också bytte färger.
const PUBLIC_ROUTES = [
  ["/", "publik-start"],
  ["/produkter", "publik-produkter"],
  ["/foreningsliv", "publik-foreningsliv"],
  ["/login", "publik-login"],
];

const browser = await chromium.launch();
const findings = [];

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("roots-theme", "dark"));

  for (const [path, name] of PUBLIC_ROUTES) {
    try {
      await page.goto(`${WEB}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      const samples = await page.evaluate(COLLECT);
      const bad = contrastFailures(samples);
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      findings.push({ name, path, total: samples.length, bad });
      console.log(
        `${bad.length === 0 && isDark ? "OK  " : "FEL "} ${name} — ${bad.length}/${samples.length} under kravet${isDark ? "" : " — TEMA EJ SATT"}`
      );
      for (const b of bad.slice(0, 8)) {
        console.log(
          `      ${b.ratio}:1 (krav ${b.need}) "${b.text}" ${b.color} på ${b.bg}\n        ${b.cls}`
        );
      }
    } catch (err) {
      console.log(`FEL  ${name} — ${String(err).slice(0, 140)}`);
      findings.push({ name, path, error: String(err).slice(0, 160), bad: [] });
    }
  }
  await context.close();
}

for (const { email, routes } of BY_ROLE) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("roots-theme", "dark"));
    for (let i = 0; i < 10; i++) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', PASSWORD);
      await page.waitForTimeout(400);
      if ((await page.inputValue('input[type="email"]')) === email) break;
    }
    await page.click('button[type="submit"]');
    // "commit" istället för default "load": i dev kompilerar Next varje
    // route vid första besöket, vilket kan ta tiotals sekunder och fick
    // waitForURL att timea ut trots att inloggningen gick igenom.
    await page.waitForURL((u) => !u.pathname.includes("/login"), {
      timeout: 60000,
      waitUntil: "commit",
    });
  } catch (err) {
    console.log(`FEL  inloggning ${email} — ${String(err).slice(0, 120)}`);
    await context.close();
    continue;
  }

  for (const [path, name] of routes) {
    try {
      await page.goto(`${WEB}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);

      // Skriptet i app/layout.tsx ska ha satt klassen från localStorage
      // före första målningen. Om den inte sitter är temat trasigt, inte
      // kontrasten — så vi mäter det som ett eget fel.
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      const hasToggle = await page
        .getByRole("button", { name: /Byt till (ljust|mörkt) läge/ })
        .count();

      const samples = await page.evaluate(COLLECT);
      const bad = contrastFailures(samples);

      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      findings.push({ name, path, total: samples.length, bad, isDark, hasToggle });
      const flags = [
        isDark ? null : "TEMA EJ SATT",
        hasToggle > 0 ? null : "VÄXEL SAKNAS",
      ].filter(Boolean);
      console.log(
        `${bad.length === 0 && flags.length === 0 ? "OK  " : "FEL "} ${name} — ${bad.length}/${samples.length} under kravet${
          flags.length ? ` — ${flags.join(", ")}` : ""
        }`
      );
      for (const b of bad.slice(0, 8)) {
        console.log(
          `      ${b.ratio}:1 (krav ${b.need}) "${b.text}" ${b.color} på ${b.bg}\n        ${b.cls}`
        );
      }
    } catch (err) {
      console.log(`FEL  ${name} — ${String(err).slice(0, 140)}`);
      findings.push({ name, path, error: String(err).slice(0, 160), bad: [] });
    }
  }

  await context.close();
}

await browser.close();

const totalBad = findings.reduce((s, f) => s + f.bad.length, 0);
const byClass = new Map();
for (const f of findings) {
  for (const b of f.bad) {
    const key = `${b.ratio}:1 ${b.color} på ${b.bg} — ${b.cls.slice(0, 70)}`;
    byClass.set(key, (byClass.get(key) || 0) + 1);
  }
}
console.log(`\n${totalBad} kontrastproblem, unika mönster:`);
for (const [k, n] of [...byClass].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n}x  ${k}`);
}
console.log(`Bilder i ${OUT}`);
process.exit(totalBad === 0 ? 0 : 1);
