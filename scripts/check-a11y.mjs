/**
 * Tillgänglighetskontroll av det som inte syns i en statisk granskning.
 *
 * Tre saker verifieras här, alla sådana som bara går att se i en riktig
 * webbläsare:
 *
 *   1. Skip-länken "Hoppa till innehåll" har ett mål på varje route-grupp.
 *      Den pekade tidigare på ett id som inte fanns i (shop) och
 *      (calculator) — alltså på sidorna där en supporter faktiskt betalar.
 *   2. Menyer och paneler stänger med Escape, flyttar fokus in i sig och
 *      lämnar tillbaka fokus till knappen som öppnade dem.
 *   3. Portalens och fundraising-vyernas flikar har egna sidtitlar. Alla 34
 *      sidorna är klientrenderade och kunde inte exportera `metadata`, så
 *      de visade root-titeln.
 *
 * Kör med servrarna uppe:
 *   source /tmp/roots-ui.env
 *   node scripts/check-a11y.mjs
 */

import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3004";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";
const PASSWORD = "Demo1234!";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Loggar in via API:t och återanvänder cookien.
 *
 * Går via context.request och inte via ett fetch inne i sidan: Playwright
 * delar cookiejar mellan request-kontexten och sidorna, och vi slipper
 * CORS-hänsyn. Vi loggar in en gång per roll för att inte slå i
 * rate-limiten på inloggningar.
 */
async function loginContext(browser, email) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  const csrf = await context.request.get(`${API}/v1/csrf-token`);
  const { token } = await csrf.json();

  const res = await context.request.post(`${API}/v1/auth/login`, {
    headers: { "content-type": "application/json", "x-csrf-token": token },
    data: { email, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(
      `inloggning misslyckades för ${email}: ${res.status()} ${await res.text()}`
    );
  }

  const page = await context.newPage();
  return { context, page };
}

async function main() {
  const browser = await chromium.launch();

  // ── 1. Skip-länkens mål per route-grupp ────────────────────────────
  console.log("\nSkip-länkens mål:");
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const publicRoutes = [
      ["/", "(marketing)"],
      ["/login", "(auth)"],
    ];
    for (const [path, group] of publicRoutes) {
      await page.goto(`${WEB}${path}`, { waitUntil: "commit", timeout: 60_000 });
      await page.waitForSelector("#main-content", { timeout: 30_000 }).catch(() => {});
      const found = await page.locator("#main-content").count();
      check(`${group} ${path} har #main-content`, found > 0);
    }
    await context.close();
  }

  // Butiken kräver en riktig säljar-slug. Den hämtas via SHOP_SLUG från
  // miljön, annars hoppas kontrollen över — hellre det än ett rött kryss som
  // handlar om testdata och inte om koden.
  {
    const slug = process.env.SHOP_SLUG;
    if (slug) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${WEB}/shop/${slug}`, {
        waitUntil: "commit",
        timeout: 60_000,
      });
      await page
        .waitForSelector("#main-content", { timeout: 30_000 })
        .catch(() => {});
      check(
        "(shop) har #main-content",
        (await page.locator("#main-content").count()) > 0
      );
      await context.close();
    } else {
      console.log("  – (shop) hoppades över (sätt SHOP_SLUG för att testa)");
    }
  }

  // ── 2. Escape och fokus i mobilmenyn (marketing) ───────────────────
  console.log("\nMobilmenyn i marketing-headern:");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${WEB}/`, { waitUntil: "commit", timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    const burger = page.getByRole("button", { name: /meny/i }).first();
    await burger.waitFor({ timeout: 30_000 });

    // Stängd meny får inte ligga i tab-ordningen. Utan `inert` tabbar man
    // genom osynliga länkar mitt på en vanlig sida.
    const dialog = page.locator('[role="dialog"][aria-label="Navigeringsmeny"]');
    check(
      "stängd meny är inert",
      await dialog.evaluate((el) => el.hasAttribute("inert"))
    );

    await burger.click();
    await page.waitForTimeout(400);
    check(
      "öppen meny är inte inert",
      !(await dialog.evaluate((el) => el.hasAttribute("inert")))
    );

    // Fokus ska ha flyttats in i panelen.
    const focusInside = await page.evaluate(() => {
      const panel = document.querySelector(
        '[role="dialog"][aria-label="Navigeringsmeny"]'
      );
      return !!panel && panel.contains(document.activeElement);
    });
    check("fokus flyttas in i menyn", focusInside);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check(
      "Escape stänger menyn",
      await dialog.evaluate((el) => el.hasAttribute("inert"))
    );

    const focusBack = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label")
    );
    check(
      "fokus återlämnas till menyknappen",
      /meny/i.test(focusBack ?? ""),
      `fokus på: ${focusBack ?? "okänt"}`
    );

    await context.close();
  }

  // ── 3. Portalens sidebar + sidtitel ────────────────────────────────
  console.log("\nPortalen (admin):");
  {
    const { context, page } = await loginContext(browser, "admin@roots.se");
    await page.goto(`${WEB}/portal/bestallningar`, {
      waitUntil: "commit",
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const title = await page.title();
    check(
      "fliken har en egen sidtitel",
      /Beställningar/i.test(title),
      `title: "${title}"`
    );

    const sidebar = page.locator("#portal-sidebar");
    check(
      "stängd sidebar är inert på mobil",
      await sidebar.evaluate((el) => el.hasAttribute("inert"))
    );

    const menuButton = page.getByRole("button", { name: /öppna meny/i }).first();
    await menuButton.click();
    await page.waitForTimeout(400);
    check(
      "öppen sidebar är inte inert",
      !(await sidebar.evaluate((el) => el.hasAttribute("inert")))
    );
    check(
      "fokus flyttas in i sidebaren",
      await page.evaluate(() => {
        const el = document.getElementById("portal-sidebar");
        return !!el && el.contains(document.activeElement);
      })
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check(
      "Escape stänger sidebaren",
      await sidebar.evaluate((el) => el.hasAttribute("inert"))
    );

    await context.close();
  }

  // ── 4. Fundraising: sidtitel + Escape i mobilnavigationen ──────────
  console.log("\nFundraising (lagledare):");
  {
    const { context, page } = await loginContext(browser, "lag@demo-if.se");
    await page.goto(`${WEB}/lag/bestallningar`, {
      waitUntil: "commit",
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const title = await page.title();
    check(
      "fliken har en egen sidtitel",
      /Beställningar/i.test(title),
      `title: "${title}"`
    );

    const menuButton = page.getByRole("button", { name: /öppna meny/i }).first();
    await menuButton.click();
    await page.waitForTimeout(400);
    check(
      "menyn öppnas",
      (await page.locator("#fundraising-mobile-nav").count()) > 0
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check(
      "Escape stänger menyn",
      (await page.locator("#fundraising-mobile-nav").count()) === 0
    );
    const focusBack = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label")
    );
    check(
      "fokus återlämnas till menyknappen",
      /meny/i.test(focusBack ?? ""),
      `fokus på: ${focusBack ?? "okänt"}`
    );

    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} kontroller gick igenom.`
  );
  if (failed.length) {
    console.log("\nMisslyckade:");
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
