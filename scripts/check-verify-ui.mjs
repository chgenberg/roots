/**
 * Visuell genomgång av bekräftelseflödet för manuella ordrar.
 *
 * Engångsskript för att se att banderollen, badgen, dialogen och
 * avräkningssiffran hänger ihop mot en riktig server. Inte ett CI-test —
 * pengavägen täcks av money-path.integration.test.ts. Det här svarar på
 * frågan "ser det ut som jag tror, och händer rätt sak när jag klickar".
 *
 * Kör med API på 3011 och web på 3004, mot en demo-seedad databas:
 *   node scripts/check-verify-ui.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL || "http://localhost:3004";
const EMAIL = "lag@demo-if.se";
// Sätts av seed-demo.ts (DEMO_PASSWORD).
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const OUT = "/tmp/roots-verify-ui";

mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FEL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log(`  [browser] ${m.text()}`);
});

try {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  // React nollställer okontrollerade fält när formuläret hydreras, så en
  // fill före hydrering försvinner tyst. Vi fyller i och kontrollerar att
  // värdet faktiskt ligger kvar innan vi skickar.
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.waitForTimeout(500);
    const kept = await page.inputValue('input[type="email"]');
    if (kept === EMAIL) break;
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 25000,
  });
  check("inloggning som lagledare", true, page.url());

  // ── Orderlistan ────────────────────────────────────────────────────
  await page.goto(`${WEB}/lag/bestallningar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const banner = page.getByText(/väntar\s*på din bekräftelse/i).first();
  check("banderoll för väntande ordrar syns", await banner.isVisible());

  const bannerText = await banner
    .locator("xpath=ancestor::div[contains(@class,'flex')][1]")
    .innerText()
    .catch(() => "");
  check(
    "banderollen anger belopp och konsekvens",
    /kr räknas inte med i avräkningen/i.test(bannerText),
    bannerText.replace(/\s+/g, " ").slice(0, 120)
  );

  // Banderollen säger "väntar på din bekräftelse", raden "Väntar på
  // bekräftelse" — olika strängar, så en exakt matchning träffar bara raden.
  const rowBadge = page.getByText("Väntar på bekräftelse", { exact: true });
  check(
    "radbadge syns i listan",
    (await rowBadge.count()) > 0 && (await rowBadge.first().isVisible())
  );

  await page.screenshot({ path: `${OUT}/01-lista.png`, fullPage: true });

  // Filtret ska minska listan till bara de väntande.
  const allCount = await page.locator("text=/^Ordrar \\(/").innerText();
  await page.getByRole("button", { name: "Visa dem" }).click();
  await page.waitForTimeout(600);
  const filteredCount = await page.locator("text=/^Ordrar \\(/").innerText();
  check(
    "filtret 'Visa dem' begränsar listan",
    allCount !== filteredCount,
    `${allCount} till ${filteredCount}`
  );
  await page.screenshot({ path: `${OUT}/02-filtrerad.png`, fullPage: true });

  // ── Dialogen ───────────────────────────────────────────────────────
  // Filtret är aktivt, så första raden är den obekräftade manuella ordern.
  // Etiketten sparas för att kunna hitta tillbaka till exakt samma order i
  // återställningssteget, när badgen som pekade ut den är borta.
  const manualRow = page
    .locator('button[aria-label^="Visa detaljer"]')
    .first();
  const manualRowLabel = await manualRow.getAttribute("aria-label");
  await manualRow.click();
  await page.waitForTimeout(1500);

  check(
    "dialogen visar sektionen för manuell betalning",
    await page.getByText("Manuell betalning").first().isVisible()
  );
  const verifyBtn = page.getByRole("button", { name: /Bekräfta betalningen/i });
  check("bekräftelseknappen finns", await verifyBtn.isVisible());
  await page.screenshot({ path: `${OUT}/03-dialog.png` });

  // Två steg: knappen ska fråga innan den flyttar pengar.
  await verifyBtn.click();
  await page.waitForTimeout(400);
  check(
    "knappen kräver en bekräftelsefråga först",
    await page.getByText(/Har du fått/i).isVisible()
  );
  await page.screenshot({ path: `${OUT}/04-fraga.png` });

  await page.getByRole("button", { name: /^Ja, bekräfta$/ }).click();
  await page.waitForTimeout(2000);

  check(
    "dialogen visar bekräftad status efteråt",
    await page.getByText(/Bekräftad .*Summan räknas med/is).isVisible()
  );
  check(
    "återtagningsvalet finns",
    await page.getByText(/Ta tillbaka bekräftelsen/i).isVisible()
  );
  await page.screenshot({ path: `${OUT}/05-bekraftad.png` });

  // Stäng dialogen — listan ska ha uppdaterats utan omladdning.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const bannerGone = !(await page
    .getByText(/väntar\s*på din bekräftelse/i)
    .first()
    .isVisible()
    .catch(() => false));
  check("banderollen försvinner när inget väntar längre", bannerGone);
  await page.screenshot({ path: `${OUT}/06-lista-efter.png`, fullPage: true });

  // ── Avräkningen ────────────────────────────────────────────────────
  await page.goto(`${WEB}/lag/avrakning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const stillWaiting = await page
    .getByText(/väntar på att du bekräftar/i)
    .isVisible()
    .catch(() => false);
  check("avräkningen visar ingen väntande summa längre", !stillWaiting);
  await page.screenshot({ path: `${OUT}/07-avrakning.png`, fullPage: true });

  // ── Återställ demodatan ────────────────────────────────────────────
  // Bekräftelsen är en riktig skrivning. Utan det här steget finns ingen
  // obekräftad order kvar nästa gång, och skriptet faller på sin egen
  // första kontroll — vilket ser ut som en regression i UI:t.
  await page.goto(`${WEB}/lag/bestallningar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator(`button[aria-label="${manualRowLabel}"]`).click();
  await page.waitForTimeout(1200);
  const revoke = page.getByRole("button", { name: /Ta tillbaka bekräftelsen/i });
  if (await revoke.isVisible().catch(() => false)) {
    await revoke.click();
    await page.waitForTimeout(1500);
    check(
      "demodatan återställd till obekräftad",
      await page.getByRole("button", { name: /Bekräfta betalningen/i }).isVisible()
    );
  } else {
    check(
      "demodatan återställd till obekräftad",
      false,
      "hittade ingen bekräftad order att återkalla — kör pnpm db:seed:demo"
    );
  }
} catch (err) {
  check("skriptet kördes utan undantag", false, String(err).slice(0, 300));
  await page.screenshot({ path: `${OUT}/99-fel.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} kontroller OK. Bilder i ${OUT}`
);
process.exit(failed.length === 0 ? 0 : 1);
