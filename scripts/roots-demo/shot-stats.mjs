// Visuell canary: logga in och skärmdumpa de tre statistik-sidorna så vi
// ser att graferna faktiskt renderas med data. node shot-stats.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3004";
const PASS = "Demo1234!";
const PAGES = [
  { email: "felicia.assoc@demo-if.se", path: "/min-shop/statistik", out: "/tmp/stats_seller.png" },
  { email: "forening@demo-if.se", path: "/forening/statistik", out: "/tmp/stats_forening.png" },
  { email: "lag@demo-if.se", path: "/lag/statistik", out: "/tmp/stats_lag.png" },
];

const browser = await chromium.launch({ headless: true });
for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(`(() => {
    const SEL = "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],[data-nextjs-dev-tools-button],#__next-build-watcher,#__next-prerender-indicator";
    function kill() {
      try { document.querySelectorAll(SEL).forEach((el) => el.style.setProperty("display", "none", "important")); } catch (e) {}
    }
    function start() { kill(); try { new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} }
    if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
  })();`);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400); // låt React hydrera innan vi skriver
  await page.locator("#email").click();
  await page.locator("#email").fill(p.email);
  await page.locator("#password").fill(PASS);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Logga in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 })
    .catch(async () => { await page.locator("#password").press("Enter").catch(() => {}); });
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500); // låt charts hämta + rita
  await page.screenshot({ path: p.out, fullPage: true });
  console.log(`✅ ${p.email} → ${p.path} → ${p.out}`);
  await ctx.close();
}
await browser.close();
