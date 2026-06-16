// Steg 1 — spela in ett riktigt rollflöde som video i mobilkontext.
//
//   node record.js <role> [locale]
//   role   = seller | forening | lag
//   locale = sv (default)
//
// Skriver:  out/<role>/<locale>/raw.webm  +  marks.json
//
// Kritiskt: recordVideo.size MÅSTE matcha viewport (CSS-pixlar) exakt,
// annars letterboxar Playwright i stället för att skala.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  BASE_URL,
  PASSWORD,
  ROLES,
  ROLE_KEYS,
  SCREEN,
  PAGE_H,
  DEFAULT_LOCALE,
  recordDir,
} from "./config.js";
import { t } from "./l10n.js";
import { FLOWS } from "./flows.js";
import { cleanupRecordingData } from "./cleanup.js";

const role = (process.argv[2] || "seller").toLowerCase();
const locale = (process.argv[3] || DEFAULT_LOCALE).toLowerCase();

if (!ROLE_KEYS.includes(role)) {
  console.error(`Okänd roll "${role}". Välj en av: ${ROLE_KEYS.join(", ")}`);
  process.exit(1);
}

const cfg = ROLES[role];
const lang = t(locale);
const OUT = recordDir(role, locale);
fs.mkdirSync(OUT, { recursive: true });

// Tap-ripple + dölj scrollbars: injiceras innan varje sida laddas så
// klicken syns i filmen och det känns mänskligt, inte som en bot.
const INIT_SCRIPT = `
(() => {
  try { localStorage.setItem("roots_cookie_consent", "all"); } catch (e) {}
  const style = document.createElement("style");
  style.textContent = \`
    *::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    /* Dölj flytande AI-chatt-knappen i filmen (klass-selektor = inga
       specialtecken som kan mismatcha pga unicode-normalisering) */
    button.fixed.bottom-6.right-6 { display: none !important; }
    .__rd_ripple {
      position: fixed; z-index: 2147483647; width: 14px; height: 14px;
      margin: -7px 0 0 -7px; border-radius: 50%;
      background: rgba(107,121,79,0.35); border: 2px solid rgba(107,121,79,0.9);
      pointer-events: none; transform: scale(0.4); opacity: 0.9;
      transition: transform .5s ease-out, opacity .5s ease-out;
    }
  \`;
  document.documentElement.appendChild(style);
  // Dölj Next.js dev-tools/"Issues"-indikatorn (nere till vänster). Den ligger
  // i en <nextjs-portal> shadow-host som injiceras sent — stylesheet-regler är
  // opålitliga, så vi sätter inline display:none via en MutationObserver i stället.
  // devIndicators:false i next.config räcker inte i Next 15.5.
  (() => {
    const SEL = "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],[data-nextjs-dev-tools-button],#__next-build-watcher,#__next-prerender-indicator,button.fixed.bottom-6.right-6";
    const kill = () => {
      try { document.querySelectorAll(SEL).forEach((el) => el.style.setProperty("display", "none", "important")); } catch (e) {}
    };
    const start = () => { kill(); try { new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} };
    if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
  })();
  window.addEventListener("pointerdown", (e) => {
    const r = document.createElement("div");
    r.className = "__rd_ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    requestAnimationFrame(() => {
      r.style.transform = "scale(3.4)";
      r.style.opacity = "0";
    });
    setTimeout(() => r.remove(), 520);
  }, true);
})();
`;

async function main() {
  console.log(`\n🎬 Spelar in: ${cfg.label} (${role}/${locale})`);

  // Reproducerbarhet: ta bort förra tagningens demo-data.
  await cleanupRecordingData(role).catch((e) =>
    console.warn(`  ⚠ städning hoppades över: ${e.message}`)
  );

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: SCREEN.w, height: PAGE_H },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    recordVideo: { dir: OUT, size: { width: SCREEN.w, height: PAGE_H } },
  });
  await ctx.addInitScript(INIT_SCRIPT);

  const page = await ctx.newPage();

  // ── Tidsmarkörer ───────────────────────────────────────────────────
  const marks = [];
  const t0 = Date.now();
  const mark = (name) => {
    const at = (Date.now() - t0) / 1000;
    marks.push({ name, t: at });
    console.log(`  • ${name} @ ${at.toFixed(2)}s`);
  };

  // ── Mänskliga hjälpare ─────────────────────────────────────────────
  const pause = (ms) => page.waitForTimeout(ms);

  const tap = async (locator) => {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(180);
    // Capad timeout så ett (oväntat) disabled/dolt element inte hänger
    // i Playwrights default-timeout (30s).
    await locator.tap({ timeout: 8000 });
    await page.waitForTimeout(120);
  };

  const type = async (locator, text) => {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.tap().catch(async () => locator.click());
    await locator.pressSequentially(text, { delay: 38 });
  };

  // Mjuk scroll till ett element i ~40 små steg (känns mänskligt).
  // Capad väntan: hittas inte elementet snabbt skippar vi i stället för
  // att fastna i Playwrights default-timeout (30s).
  const softScrollTo = async (locator) => {
    const el = locator.first();
    try {
      await el.waitFor({ state: "visible", timeout: 3500 });
    } catch {
      return;
    }
    const box = await el.boundingBox().catch(() => null);
    if (!box) return;
    const target = await page.evaluate(
      ([y, h]) => Math.max(0, window.scrollY + y - (window.innerHeight - h) / 2),
      [box.y, box.height]
    );
    const from = await page.evaluate(() => window.scrollY);
    const steps = 45;
    for (let i = 1; i <= steps; i++) {
      const y = from + ((target - from) * i) / steps;
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(16);
    }
  };

  // OBS: ingen waitForLoadState("networkidle") — sidor med live-polling
  // (chatt, dashboards) blir aldrig "idle" och skulle ge 30s-hängningar.
  // Varje beat väntar i stället in sitt eget element (waitFor på rubrik).
  const navTo = async (linkName) => {
    const opener = page.getByRole("button", { name: lang.nav.open });
    if (await opener.count()) {
      await tap(opener.first());
      await page.waitForTimeout(300);
    }
    await tap(page.getByRole("link", { name: linkName }).first());
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(900);
  };

  const login = async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    // dismissa ev. cookie-banner (oftast ingen)
    const accept = page.getByRole("button", { name: /Acceptera|Godkänn/ });
    if (await accept.count()) await accept.first().click().catch(() => {});
    await page.locator(lang.login.emailSel).waitFor({ timeout: 10000 });
    await pause(500);
    await type(page.locator(lang.login.emailSel), cfg.email);
    await pause(200);
    await type(page.locator(lang.login.passwordSel), PASSWORD);
    await pause(250);
    await tap(page.getByRole("button", { name: lang.login.submit }).first());
    mark("loginSubmit");
    await page.waitForURL(`**${cfg.landing}`, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await hideChrome();
  };

  // Göm Next.js dev-indikatorn ("N Issues") + flytande chatt-knapp via en
  // persistent <style> i head. addStyleTag körs i riktiga browsern (ingen
  // template-literal-escaping) och överlever klient-navigering, så den är
  // pålitligare än init-scriptets observer för shadow-host-element.
  const hideChrome = async () => {
    await page
      .addStyleTag({
        content:
          "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],[data-nextjs-dev-tools-button],#__next-dev-tools-indicator{display:none !important}" +
          "button.fixed.bottom-6.right-6{display:none !important}",
      })
      .catch(() => {});
  };

  const flowCtx = {
    page,
    cfg,
    t: lang,
    mark,
    tap,
    type,
    softScrollTo,
    pause,
    navTo,
    login,
    hideChrome,
  };

  // Liten realtidsmarginal i början för intro-fade.
  await page.waitForTimeout(400);

  const flow = FLOWS[role];
  await flow(flowCtx);

  await page.waitForTimeout(800);

  // ── Spara video + markörer ─────────────────────────────────────────
  const video = page.video();
  await ctx.close(); // måste stängas innan videon finns på disk
  await browser.close();

  if (video) {
    const tmp = await video.path();
    const dst = path.join(OUT, "raw.webm");
    fs.copyFileSync(tmp, dst);
    try {
      fs.unlinkSync(tmp);
    } catch (e) {}
    console.log(`  ✅ raw.webm → ${dst}`);
  }

  fs.writeFileSync(
    path.join(OUT, "marks.json"),
    JSON.stringify({ role, locale, marks }, null, 2)
  );
  console.log(`  ✅ marks.json (${marks.length} markörer)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
