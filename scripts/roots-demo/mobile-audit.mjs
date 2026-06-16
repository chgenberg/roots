// Mobil-audit: besöker varje sida i en 390px-viewport, mäter horisontell
// overflow (scrollWidth > clientWidth) och pekar ut de bredaste elementen.
// Screenshot per sida sparas i out/mobile-audit/. Inga ändringar görs.
//
//   node mobile-audit.mjs            # alla roller
//   node mobile-audit.mjs forening   # bara en roll-grupp
//
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE_URL, ROOT } from "./config.js";

const PASSWORD = "Demo1234!";
const WIDTH = 390; // iPhone 14/15-bredd (CSS-px)
const HEIGHT = 844;

const GROUPS = {
  public: {
    login: null,
    pages: [
      "/", "/produkter", "/foreningsliv", "/om-oss", "/kontakt",
      "/hjalp", "/villkor", "/integritet", "/haranalys", "/login", "/registrera",
    ],
  },
  seller: {
    login: "felicia.assoc@demo-if.se",
    pages: [
      "/min-shop", "/min-shop/statistik", "/min-shop/bestallningar",
      "/min-shop/chatt", "/installningar",
    ],
  },
  forening: {
    login: "forening@demo-if.se",
    pages: [
      "/forening", "/forening/statistik", "/forening/kom-igang",
      "/forening/lag", "/forening/mal", "/forening/kalender", "/forening/avrakning",
    ],
  },
  lag: {
    login: "lag@demo-if.se",
    pages: [
      "/lag", "/lag/statistik", "/lag/saljare", "/lag/bestallningar",
      "/lag/chatt", "/lag/avrakning",
    ],
  },
  portal: {
    login: "admin@roots.se",
    pages: [
      "/portal", "/portal/saljare", "/portal/pipeline", "/portal/offerter",
      "/portal/bestallningar", "/portal/produkter", "/portal/raknesnurra",
      "/portal/medlemmar", "/portal/klubbar", "/portal/statistik",
      "/portal/intakter", "/portal/fakturor", "/portal/audit-log",
      "/portal/system", "/portal/ai", "/portal/installningar",
    ],
  },
};

const OVERFLOW_PROBE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const docOverflow = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0) - vw;
  const offenders = [];
  const all = document.body ? document.body.querySelectorAll("*") : [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    // element som sticker ut till höger eller är bredare än viewporten
    if (r.width > vw + 1 || r.right > vw + 1) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.position === "sticky") continue; // hanteras separat
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
        w: Math.round(r.width),
        right: Math.round(r.right),
        txt: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }
  // de-dup + sortera på bredd, ta topp 6
  const seen = new Set();
  const top = offenders
    .sort((a, b) => b.w - a.w)
    .filter((o) => { const k = o.tag + o.cls; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 6);
  return { vw, docOverflow, count: offenders.length, top };
})();`;

async function login(page, email) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.locator("#email").click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function run() {
  const only = process.argv[2];
  const outDir = path.join(ROOT, "out", "mobile-audit");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const [group, cfg] of Object.entries(GROUPS)) {
    if (only && only !== group) continue;
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    // dölj dev-tools-badge + chatt så de inte stör mätningen
    await ctx.addInitScript(`(() => {
      const SEL = "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],[data-nextjs-dev-tools-button]";
      const kill = () => { try { document.querySelectorAll(SEL).forEach((el) => el.style.setProperty("display","none","important")); } catch(e){} };
      const start = () => { kill(); try { new MutationObserver(kill).observe(document.documentElement,{childList:true,subtree:true}); } catch(e){} };
      if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
    })();`);
    const page = await ctx.newPage();

    if (cfg.login) {
      try { await login(page, cfg.login); }
      catch (e) { console.log(`  ⚠ login ${cfg.login} misslyckades: ${e.message}`); }
    }

    for (const p of cfg.pages) {
      try {
        await page.goto(`${BASE_URL}${p}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1400);
        const probe = await page.evaluate(OVERFLOW_PROBE);
        const slug = (group + p.replace(/\//g, "_")) || group + "_root";
        const shot = path.join(outDir, `${slug}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const bad = probe.docOverflow > 1;
        report.push({ group, path: p, ...probe });
        const flag = bad ? "❌ OVERFLOW " + probe.docOverflow + "px" : "✅";
        console.log(`${flag}  ${group}${p}`);
        if (bad) {
          for (const o of probe.top) {
            console.log(`      · <${o.tag}> w=${o.w} right=${o.right} "${o.txt}" .${o.cls}`);
          }
        }
      } catch (e) {
        console.log(`  ⚠ ${group}${p}: ${e.message}`);
        report.push({ group, path: p, error: e.message });
      }
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  const overflows = report.filter((r) => r.docOverflow > 1);
  console.log(`\n— ${overflows.length} sidor med horisontell overflow av ${report.length} —`);
  console.log(`Screenshots + report.json: ${outDir}`);
}

run();
