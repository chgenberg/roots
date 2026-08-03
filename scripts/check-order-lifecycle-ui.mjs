/**
 * Visuell genomgång av orderns livscykel: leverans och avbokning.
 *
 * Engångsskript, inte ett CI-test — pengaeffekten täcks av
 * money-path.integration.test.ts. Det här svarar på frågan om leveransstegen
 * och avbokningsformuläret faktiskt syns och gör rätt sak när man klickar,
 * mot en riktig server.
 *
 * Bakgrunden: statusarna CANCELLED och REFUNDED fanns i databasen från
 * början men ingen kodväg satte dem, och fulfillment-endpointen fanns utan
 * någon yta som anropade den. En order kunde alltså bli betald och sedan
 * aldrig komma längre.
 *
 * Kör med API på 3011 och web på 3004, mot en demo-seedad databas:
 *   node scripts/check-order-lifecycle-ui.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL || "http://localhost:3004";
const EMAIL = "lag@demo-if.se";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const OUT = "/tmp/roots-lifecycle-ui";

mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FEL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log(`  [browser] ${m.text()}`);
});

try {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  // React nollställer okontrollerade fält vid hydrering, så en fill före
  // hydrering försvinner tyst.
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.waitForTimeout(500);
    if ((await page.inputValue('input[type="email"]')) === EMAIL) break;
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 30000,
  });
  check("inloggning som lagledare", true, page.url());

  await page.goto(`${WEB}/lag/bestallningar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Listan är knappar, inte en tabell — varje order har aria-label
  // "Visa detaljer för order från …".
  const rows = page.getByRole("button", { name: /Visa detaljer för order/i });
  const rowCount = await rows.count();
  check("orderlistan har rader", rowCount > 0, `${rowCount} rader`);

  // Vi vill helst öppna en order som står på "Betald", för då finns det ett
  // nästa leveranssteg att faktiskt trycka på. En redan levererad order
  // visar bara ångra-knappen, vilket också är rätt men testar mindre.
  const texts = [];
  for (let i = 0; i < rowCount; i++) {
    texts.push((await rows.nth(i).innerText()).replace(/\s+/g, " "));
  }
  const order =
    texts.findIndex((t) => /Betald/.test(t) && !/Levererad|Skickad/.test(t)) !==
    -1
      ? texts.findIndex(
          (t) => /Betald/.test(t) && !/Levererad|Skickad/.test(t)
        )
      : texts.findIndex((t) => /Betald|Skickad|Levererad/.test(t));
  if (order === -1) throw new Error("hittade ingen betald order att öppna");

  await rows.nth(order).click();
  await page.waitForTimeout(1200);
  check(
    "orderdialog öppnad",
    await page.getByRole("dialog").isVisible(),
    texts[order].slice(0, 70)
  );

  const dialog = page.getByRole("dialog");
  await page.screenshot({ path: `${OUT}/01-dialog.png`, fullPage: false });

  // ── Leveranssteg ───────────────────────────────────────────────────
  const fulfilment = dialog.getByRole("heading", { name: "Leverans" });
  const hasFulfilment = await fulfilment.isVisible().catch(() => false);
  check("leveransavsnittet syns för lagledaren", hasFulfilment);

  if (hasFulfilment) {
    const shipBtn = dialog.getByRole("button", { name: /Markera skickad/i });
    const deliverBtn = dialog.getByRole("button", {
      name: /Markera levererad/i,
    });
    const undoOnly = dialog.getByRole("button", {
      name: /Ångra leveransmarkering/i,
    });
    // En order som redan är levererad har inget nästa steg, och då ska
    // ångra-knappen finnas i stället. Båda utfallen är korrekta.
    const anyStep =
      (await shipBtn.isVisible().catch(() => false)) ||
      (await deliverBtn.isVisible().catch(() => false)) ||
      (await undoOnly.isVisible().catch(() => false));
    check("leveransstegen erbjuder en åtgärd", anyStep);

    if (await shipBtn.isVisible().catch(() => false)) {
      await shipBtn.click();
      await page.waitForTimeout(1500);
      const status = (await dialog.innerText()).replace(/\s+/g, " ");
      check(
        "statusen flyttas till skickad",
        /Skickad/.test(status),
        status.slice(0, 90)
      );
      await page.screenshot({ path: `${OUT}/02-skickad.png` });

      const undo = dialog.getByRole("button", {
        name: /Ångra leveransmarkering/i,
      });
      check("ångra-knappen finns när ordern flyttats", await undo.isVisible());

      // Återställ demo-datan så nästa körning börjar från samma läge.
      await undo.click();
      await page.waitForTimeout(1200);
      check(
        "ångra tar ordern tillbaka till betald",
        /BETALD/i.test(await dialog.innerText())
      );
    }
  }

  // ── Avbokning ──────────────────────────────────────────────────────
  const cancelTrigger = dialog.getByRole("button", {
    name: /Återbetala eller avboka|Avboka ordern/i,
  });
  const hasCancel = await cancelTrigger.first().isVisible().catch(() => false);
  check("avbokning erbjuds", hasCancel);

  if (hasCancel) {
    await cancelTrigger.first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/03-avbokning.png` });

    const reason = dialog.locator("#cancel-reason");
    check("skälfältet syns", await reason.isVisible());

    // Knappen ska vara låst tills ett skäl skrivits — annars går det inte
    // att i efterhand se varför pengar togs ur avräkningen.
    const submit = dialog
      .getByRole("button", { name: /Markera som återbetald|Avboka ordern/i })
      .last();
    check("bekräftelseknappen är låst utan skäl", await submit.isDisabled());

    await reason.fill("Testavbokning från livscykel-skriptet");
    await page.waitForTimeout(300);
    check("knappen låses upp med skäl", !(await submit.isDisabled()));

    const warning = (await dialog.innerText()).replace(/\s+/g, " ");
    check(
      "konsekvensen för pengarna står i klartext",
      /tas ur lagets förtjänst/i.test(warning)
    );

    // Vi trycker inte igenom avbokningen här — den skulle ändra demo-datan
    // för nästa körning. Utfallet täcks av integrationstestet.
    await dialog.getByRole("button", { name: "Avbryt" }).last().click();
    await page.waitForTimeout(400);
    check("avbokningen kan avbrytas", !(await reason.isVisible()));
  }

  await page.screenshot({ path: `${OUT}/04-slut.png` });
} catch (err) {
  check("skriptet kunde köra klart", false, String(err.message || err));
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
