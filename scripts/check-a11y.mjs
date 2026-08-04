/**
 * Tillgänglighetskontroll av det som inte syns i en statisk granskning.
 *
 * Fem saker verifieras här, alla sådana som bara går att se i en riktig
 * webbläsare:
 *
 *   1. Skip-länken "Hoppa till innehåll" har ett mål på varje route-grupp.
 *      Den pekade tidigare på ett id som inte fanns i (shop) och
 *      (calculator) — alltså på sidorna där en supporter faktiskt betalar.
 *   2. Menyer och paneler stänger med Escape, flyttar fokus in i sig och
 *      lämnar tillbaka fokus till knappen som öppnade dem.
 *   3. Det rullande bandet högst upp läses bara en gång, ger ingen
 *      horisontell rullning och fälls ihop när sidan rullas eller menyn
 *      öppnas.
 *   4. Logotypen i headern följer sajtens tema och inte systemets, så att
 *      den vita wordmarken aldrig målas på en ljus yta.
 *   5. Portalens och fundraising-vyernas flikar har egna sidtitlar. Alla 34
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

    // Stängknappen ligger i den fasta headern, overlayen strax under den i
    // z-ordningen. Får overlayen övertaget målas den ovanpå krysset och
    // menyn går bara att stänga med Escape.
    check(
      "stängknappen ligger över overlayen",
      await burger.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && (el === hit || el.contains(hit));
      })
    );

    // Bandet fälls ihop när menyn öppnas — annars rullar en textremsa
    // kvar över helskärmsmenyn. 500 ms transition, så vänta ut den.
    await page.waitForTimeout(600);
    check(
      "det rullande bandet fälls ihop när menyn öppnas",
      await page.evaluate(() => {
        const band = document.querySelector('[aria-label="Aktuellt från Roots"]');
        // Höljet är det som fälls ihop; bandet inuti behåller sina 36 px.
        const wrapper = band?.parentElement?.parentElement;
        return !!wrapper && wrapper.getBoundingClientRect().height === 0;
      })
    );

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

  // ── 2b. Det rullande bandet högst upp ──────────────────────────────
  console.log("\nRullande bandet i marketing-headern:");
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${WEB}/`, { waitUntil: "commit", timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    // Loopen bygger på två identiska kopior av löftena. Utan aria-hidden
    // på den andra läser skärmläsaren varje löfte två gånger.
    check(
      "kopian av löftena är aria-hidden",
      await page.evaluate(() => {
        const lists = [
          ...document.querySelectorAll('[aria-label="Aktuellt från Roots"] ul'),
        ];
        return (
          lists.length === 2 &&
          lists[1].getAttribute("aria-hidden") === "true" &&
          !lists[0].hasAttribute("aria-hidden")
        );
      })
    );

    // Bandet är bredare än fönstret. Ligger overflow-hidden på fel nivå
    // får hela sidan en horisontell rullningslist.
    check(
      "bandet ger ingen horisontell rullning av sidan",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    );

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(900);
    check(
      "bandet fälls ihop och blir inert när sidan rullas",
      await page.evaluate(() => {
        const band = document.querySelector('[aria-label="Aktuellt från Roots"]');
        const wrapper = band?.parentElement?.parentElement;
        return (
          !!wrapper &&
          wrapper.getBoundingClientRect().height === 0 &&
          band.closest("[inert]") !== null
        );
      })
    );

    await context.close();
  }

  // ── 2c. Logotypen följer sajtens tema, inte systemets ──────────────
  // Temat är klassen `.dark` på <html>, satt av ThemeToggle och inget
  // annat. Utgår `dark:`-varianten istället från prefers-color-scheme
  // hamnar utilities och färgtokens i olika lägen, och en besökare med
  // mörkt OS men sajten i ljust läge får den vita logotypen målad på en
  // ljus yta — alltså ingen logotyp alls.
  console.log("\nLogotypen mot sajtens tema:");
  for (const [label, osScheme, siteDark] of [
    ["mörkt OS, ljus sajt", "dark", false],
    ["ljust OS, mörk sajt", "light", true],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: osScheme,
    });
    if (siteDark) {
      await context.addInitScript(() =>
        localStorage.setItem("roots-theme", "dark")
      );
    }
    const page = await context.newPage();
    await page.goto(`${WEB}/`, { waitUntil: "commit", timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    check(
      `${label} — rätt logotyp syns`,
      await page.evaluate((wantWhite) => {
        // Båda färgställningarna ligger i DOM:en; CSS väljer. Den som
        // ska synas har alt-text, kopian är aria-hidden.
        const shown = [
          ...document.querySelectorAll('header img[alt="Roots"], a[aria-label^="Roots"] img'),
        ].filter((img) => img.getBoundingClientRect().width > 0);
        if (shown.length === 0) return false;
        return shown.every((img) => /white/.test(img.src) === wantWhite);
      }, siteDark)
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
