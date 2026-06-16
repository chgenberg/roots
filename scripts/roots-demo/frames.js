// Steg 2 — rendera ram-assets med Playwright själv (ingen extern mockup).
//
//   node frames.js <role> [locale] [variant]
//   variant = desktop (default) | mobile
//
// Skriver till out/<role>/<locale>/<variant>/:
//   bg.png    — bakgrund + telefonens vita "glasplatta" (+ sidotext på desktop)
//   frame.png — transparent overlay: bezel, statusbar 09:41, Dynamic Island
//   intro.png / outro.png — brandade titelkort
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  BRAND,
  FONT_HEAD,
  FONT_BODY,
  ROLES,
  ROLE_KEYS,
  DEFAULT_LOCALE,
  geom,
  variantDir,
} from "./config.js";
import { t } from "./l10n.js";

const role = (process.argv[2] || "seller").toLowerCase();
const locale = (process.argv[3] || DEFAULT_LOCALE).toLowerCase();
const variant = (process.argv[4] || "desktop").toLowerCase();

if (!ROLE_KEYS.includes(role)) {
  console.error(`Okänd roll "${role}". Välj: ${ROLE_KEYS.join(", ")}`);
  process.exit(1);
}

const cfg = ROLES[role];
const lang = t(locale);
const title = lang.titles[role];
const G = geom(variant);
const OUT = variantDir(role, locale, variant);
fs.mkdirSync(OUT, { recursive: true });

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${FONT_HEAD}:wght@600;700;800&family=${FONT_BODY}:wght@400;500;600&display=swap" rel="stylesheet">`;

function shell(inner, extraCss = "") {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${G.canvas.w}px;height:${G.canvas.h}px;overflow:hidden;
      font-family:'${FONT_BODY}',sans-serif;color:${BRAND.ink}}
    .head{font-family:'${FONT_HEAD}','${FONT_BODY}',sans-serif}
    ${extraCss}
  </style></head><body>${inner}</body></html>`;
}

const leaf = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="M12 2C7 6 4 10 4 15a8 8 0 0 0 16 0c0-5-3-9-8-13Z" fill="${BRAND.forest}"/><path d="M12 6v12" stroke="${BRAND.offwhite}" stroke-width="1.4" stroke-linecap="round"/></svg>`;

// ── bg.png ───────────────────────────────────────────────────────────
function bgHtml() {
  const plate = `<div style="position:absolute;left:${G.x}px;top:${G.y}px;
    width:${G.w}px;height:${G.h}px;border-radius:${G.radius}px;background:${BRAND.white};
    box-shadow:0 40px 90px rgba(29,29,27,.28),0 12px 30px rgba(29,29,27,.18)"></div>`;

  let side = "";
  if (G.side) {
    side = `<div style="position:absolute;left:96px;top:0;width:580px;height:100%;
      display:flex;flex-direction:column;justify-content:center;gap:22px">
      <div style="display:flex;align-items:center;gap:14px">${leaf}
        <span class="head" style="font-size:30px;font-weight:800;letter-spacing:-.5px">Roots</span></div>
      <div style="display:inline-flex;align-items:center;align-self:flex-start;gap:8px;
        background:${BRAND.forestSoft};color:${BRAND.forest};font-weight:600;
        font-size:16px;letter-spacing:2px;padding:8px 16px;border-radius:999px">${title.kicker}</div>
      <h1 class="head" style="font-size:62px;line-height:1.04;font-weight:800;
        letter-spacing:-1.5px;color:${BRAND.ink};max-width:540px">${title.side}</h1>
      <p style="font-size:24px;line-height:1.4;color:${BRAND.sand};max-width:460px">${title.sideSub}</p>
    </div>`;
  }

  return shell(
    `<div style="position:absolute;inset:0;background:
       radial-gradient(120% 90% at 30% 20%, ${BRAND.forestSoft} 0%, ${BRAND.offwhite} 48%, ${BRAND.sandLight} 100%)"></div>
     ${side}${plate}`
  );
}

// ── frame.png (transparent overlay) ──────────────────────────────────
function frameHtml() {
  const islandW = Math.round(G.w * 0.3);
  const island = `<div style="position:absolute;left:${G.x + (G.w - islandW) / 2}px;
    top:${G.y + Math.round(G.status * 0.28)}px;width:${islandW}px;height:${Math.round(G.status * 0.62)}px;
    background:#0b0b0c;border-radius:999px"></div>`;

  const homeW = Math.round(G.w * 0.34);
  const home = `<div style="position:absolute;left:${G.x + (G.w - homeW) / 2}px;
    top:${G.y + G.h - Math.round(22 * (variant === "mobile" ? 1.9 : 1))}px;width:${homeW}px;
    height:${Math.round(6 * (variant === "mobile" ? 1.9 : 1))}px;background:${BRAND.ink};
    opacity:.85;border-radius:999px"></div>`;

  // Bezel-ring som täcker videons fyrkantiga hörn.
  const bezel = `<div style="position:absolute;left:${G.x}px;top:${G.y}px;width:${G.w}px;height:${G.h}px;
    border-radius:${G.radius}px;border:${G.bezel}px solid #0c0c0d;
    box-shadow:0 0 0 2px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.06)"></div>`;

  // Statusbar 09:41 + ikoner (ligger på den vita plattan).
  const fs1 = Math.round(17 * (variant === "mobile" ? 1.9 : 1));
  const padX = G.bezel + Math.round(20 * (variant === "mobile" ? 1.9 : 1));
  const bars = `<svg width="${Math.round(20 * (variant === "mobile" ? 1.9 : 1))}" height="${fs1}" viewBox="0 0 20 14"><rect x="0" y="9" width="3" height="5" rx="1" fill="${BRAND.ink}"/><rect x="5" y="6" width="3" height="8" rx="1" fill="${BRAND.ink}"/><rect x="10" y="3" width="3" height="11" rx="1" fill="${BRAND.ink}"/><rect x="15" y="0" width="3" height="14" rx="1" fill="${BRAND.ink}"/></svg>`;
  const wifi = `<svg width="${Math.round(20 * (variant === "mobile" ? 1.9 : 1))}" height="${fs1}" viewBox="0 0 20 14"><path d="M10 12.5l2.6-3.2a3.3 3.3 0 0 0-5.2 0L10 12.5ZM3.5 5.3a10 10 0 0 1 13 0l-1.7 2.1a7.3 7.3 0 0 0-9.6 0L3.5 5.3Z" fill="${BRAND.ink}"/></svg>`;
  const batt = `<svg width="${Math.round(28 * (variant === "mobile" ? 1.9 : 1))}" height="${fs1}" viewBox="0 0 28 14"><rect x="1" y="2" width="22" height="10" rx="3" fill="none" stroke="${BRAND.ink}" stroke-opacity=".5"/><rect x="3" y="4" width="16" height="6" rx="1.5" fill="${BRAND.forest}"/><rect x="24.5" y="5" width="2" height="4" rx="1" fill="${BRAND.ink}" fill-opacity=".5"/></svg>`;

  const statusbar = `<div style="position:absolute;left:${G.x}px;top:${G.y}px;width:${G.w}px;height:${G.status}px;
    display:flex;align-items:center;justify-content:space-between;padding:0 ${padX}px;
    font-family:'${FONT_BODY}';font-weight:600;font-size:${fs1}px;color:${BRAND.ink}">
    <span>09:41</span>
    <span style="display:flex;align-items:center;gap:6px">${bars}${wifi}${batt}</span>
  </div>`;

  return shell(`${statusbar}${island}${bezel}${home}`);
}

// ── intro / outro titelkort ──────────────────────────────────────────
function cardHtml(lines, kind) {
  const big = variant === "mobile" ? 92 : 96;
  const isOutro = kind === "outro";
  const bg = isOutro
    ? `radial-gradient(120% 100% at 50% 0%, ${BRAND.forest} 0%, #54603F 100%)`
    : `radial-gradient(120% 100% at 50% 100%, ${BRAND.forestSoft} 0%, ${BRAND.offwhite} 60%, ${BRAND.sandLight} 100%)`;
  const fg = isOutro ? BRAND.offwhite : BRAND.ink;
  const sub = isOutro ? "rgba(250,246,239,.8)" : BRAND.sand;
  const chipBg = isOutro ? "rgba(250,246,239,.16)" : BRAND.white;
  const chipFg = isOutro ? BRAND.offwhite : BRAND.forest;

  const head = isOutro
    ? `<div style="display:flex;align-items:center;gap:14px;justify-content:center">
        ${leaf}<span class="head" style="font-size:34px;font-weight:800;color:${BRAND.offwhite}">Roots</span></div>`
    : `<div style="display:inline-flex;align-items:center;gap:8px;background:${chipBg};
        color:${chipFg};font-weight:600;font-size:16px;letter-spacing:2px;
        padding:9px 18px;border-radius:999px">${title.kicker}</div>`;

  const linesHtml = lines
    .map((l) => `<div>${l}</div>`)
    .join("");

  return shell(
    `<div style="position:absolute;inset:0;background:${bg};
       display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;padding:0 12%">
       ${head}
       <h1 class="head" style="font-size:${big}px;line-height:1.02;font-weight:800;
         letter-spacing:-2px;color:${fg}">${linesHtml}</h1>
       <p style="font-size:26px;color:${sub}">roots.se</p>
     </div>`
  );
}

async function shot(page, html, file, omitBackground = false) {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const dst = path.join(OUT, file);
  await page.screenshot({ path: dst, omitBackground });
  console.log(`  ✅ ${file}`);
}

async function main() {
  console.log(`\n🖼  Ramar: ${cfg.label} (${role}/${locale}/${variant})`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: G.canvas.w, height: G.canvas.h },
    deviceScaleFactor: 1,
  });

  await shot(page, bgHtml(), "bg.png");
  await shot(page, frameHtml(), "frame.png", true);
  await shot(page, cardHtml(title.intro, "intro"), "intro.png");
  await shot(page, cardHtml(title.outro, "outro"), "outro.png");

  await browser.close();
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
