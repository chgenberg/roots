#!/usr/bin/env node
/**
 * Klickar igenom den nya pipeline-vyn: drar kort mellan steg (både ett
 * tillåtet och ett blockerat drag), öppnar detalj-popupen, växlar till
 * listvy och tillbaka. Sparar skärmbilder i /tmp/pipeline-shots och loggar
 * console-fel + misslyckade requests.
 *
 * Kör:  node scripts/pipeline-check.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3004").replace(/\/$/, "");
const OUT = "/tmp/pipeline-shots";
const EMAIL = "salj@roots.se";
const PASSWORD = "Demo1234!";

fs.mkdirSync(OUT, { recursive: true });

const HIDE_CHROME = `
  nextjs-portal,[data-next-badge-root],[data-nextjs-toast]{display:none!important}
`;

const problems = [];

/**
 * Dispatchar riktiga HTML5-dragevents. Playwrights dragTo kan inte pausa
 * mitt i ett drag, och rena mus-rörelser triggar inte drag-eventen i
 * Chromium — så vi styr sekvensen själva och kan fota hover-tillståndet.
 */
async function drag(page, dealId, toStage, { stopBeforeDrop = false } = {}) {
  return page.evaluate(
    ({ dealId, toStage, stopBeforeDrop }) => {
      const src = document.querySelector(`[data-deal-id="${dealId}"]`);
      const tgt = document.querySelector(`[data-stage="${toStage}"]`);
      if (!src || !tgt) return { ok: false, reason: "hittade inte element" };
      const dt = new DataTransfer();
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
      src.dispatchEvent(new DragEvent("dragstart", opts));
      tgt.dispatchEvent(new DragEvent("dragover", opts));
      if (stopBeforeDrop) return { ok: true, held: true };
      tgt.dispatchEvent(new DragEvent("drop", opts));
      src.dispatchEvent(new DragEvent("dragend", opts));
      return { ok: true };
    },
    { dealId, toStage, stopBeforeDrop }
  );
}

const stageOf = (page, dealId) =>
  page.evaluate(
    (id) =>
      document
        .querySelector(`[data-deal-id="${id}"]`)
        ?.closest("[data-stage]")
        ?.getAttribute("data-stage") ?? null,
    dealId
  );

const AUTH_STATE = "/tmp/pipeline-auth.json";

async function main() {
  const browser = await chromium.launch();
  // Återanvänd sessionen mellan körningar. API:et rate-limitar login per
  // IP+konto, och upprepade körningar slog annars i taket (429).
  const reuse =
    fs.existsSync(AUTH_STATE) &&
    Date.now() - fs.statSync(AUTH_STATE).mtimeMs < 30 * 60 * 1000;
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    ...(reuse ? { storageState: AUTH_STATE } : {}),
  });
  const page = await ctx.newPage();

  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && !r.url().includes("/_next/")) {
      problems.push(`${s} ${r.url().replace(BASE, "").slice(0, 140)}`);
    }
  });

  // ── Logga in ────────────────────────────────────────────────────
  await page.goto(`${BASE}/portal/pipeline`, { waitUntil: "load", timeout: 40000 });
  if (new URL(page.url()).pathname.startsWith("/login")) {
    const email = page.locator('input[type="email"]');
    const pw = page.locator('input[type="password"]');
    await email.waitFor({ state: "visible", timeout: 15000 });
    // Fälten är React-kontrollerade: fyll och verifiera att värdet ligger kvar.
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(400);
      await email.fill(EMAIL);
      await pw.fill(PASSWORD);
      if ((await email.inputValue()) === EMAIL && (await pw.inputValue()) === PASSWORD) break;
    }
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1200);
    if (new URL(page.url()).pathname.startsWith("/login")) {
      throw new Error("inloggning misslyckades (rate limit? rensa rl:login-nyckeln i Redis)");
    }
    await ctx.storageState({ path: AUTH_STATE });
    console.log("✓ inloggad som säljare");
  } else {
    console.log("✓ återanvände sparad session");
  }

  await page.goto(`${BASE}/portal/pipeline`, { waitUntil: "load", timeout: 40000 });
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.waitForTimeout(2500);

  const cardIds = await page.$$eval('[data-deal-id][draggable="true"]', (els) =>
    els.map((e) => ({
      id: e.getAttribute("data-deal-id"),
      kind: e.getAttribute("data-deal-kind"),
      stage: e.closest("[data-stage]")?.getAttribute("data-stage"),
    }))
  );
  console.log(`✓ tavlan renderad med ${cardIds.length} dragbara kort`);
  for (const c of cardIds) console.log(`    ${c.stage.padEnd(9)} ${c.kind}`);
  await page.screenshot({ path: `${OUT}/01-tavla.png`, fullPage: true });

  // ── Håll ett drag över en tillåten kolumn och fota ──────────────
  const quote = cardIds.find((c) => c.kind === "QUOTE" && c.stage === "DRAFT")
    ?? cardIds.find((c) => c.kind === "QUOTE");
  if (!quote) {
    problems.push("hittade ingen offert att dra");
  } else {
    const targetStage = quote.stage === "SENT" ? "ACCEPTED" : "SENT";
    await drag(page, quote.id, targetStage, { stopBeforeDrop: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/02-drag-tillaten.png` });

    // Blockerat drag: offert tillbaka till Lead.
    await drag(page, quote.id, "LEAD", { stopBeforeDrop: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/03-drag-blockerad.png` });
    // Fullfölj det blockerade draget → ska ge felmeddelande, inte flytt.
    await drag(page, quote.id, "LEAD");
    await page.waitForTimeout(1500);
    const stillThere = await stageOf(page, quote.id);
    if (stillThere === quote.stage) {
      console.log(`✓ blockerat drag stoppades (kortet kvar i ${stillThere})`);
    } else {
      problems.push(`blockerat drag flyttade kortet till ${stillThere}`);
    }
    await page.screenshot({ path: `${OUT}/04-blockerad-toast.png` });

    // ── Tillåtet drag ────────────────────────────────────────────
    await drag(page, quote.id, targetStage);
    await page.waitForTimeout(2500);
    const landed = await stageOf(page, quote.id);
    if (landed === targetStage) {
      console.log(`✓ drag flyttade offerten ${quote.stage} → ${landed}`);
    } else {
      problems.push(`drag landade i ${landed}, förväntade ${targetStage}`);
    }
    await page.screenshot({ path: `${OUT}/05-efter-drag.png`, fullPage: true });

    // Flytta tillbaka så databasen ser ut som innan.
    await drag(page, quote.id, quote.stage);
    await page.waitForTimeout(2000);
  }

  // ── Lead → offertdialog vid drag till Utkast ───────────────────
  const lead = cardIds.find((c) => c.kind === "LEAD");
  if (lead) {
    await drag(page, lead.id, "DRAFT");
    await page.waitForTimeout(1500);
    const dlg = page.locator('[role="dialog"]');
    const heading = (await dlg.count()) ? await dlg.first().innerText() : "";
    if (/Ny offert/.test(heading)) {
      console.log("✓ drag av lead öppnar offertdialogen med förvald förening");
      await page.screenshot({ path: `${OUT}/06-lead-till-offert.png` });
    } else {
      problems.push("drag av lead öppnade inte offertdialogen");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  } else {
    console.log("  (inget lead på tavlan — hoppar över lead-draget)");
  }

  // ── Detalj-popup: lead respektive offert ───────────────────────
  for (const [label, kind, file] of [
    ["lead", "LEAD", "07-popup-lead.png"],
    ["offert", "QUOTE", "07b-popup-offert.png"],
  ]) {
    const card = page.locator(`[data-deal-kind="${kind}"][draggable="true"]`);
    if ((await card.count()) === 0) {
      console.log(`  (inget ${label}-kort — hoppar över)`);
      continue;
    }
    await card.first().click();
    await page.waitForTimeout(2500);
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count()) {
      const text = await dialog.first().innerText();
      console.log(`✓ ${label}-popup: ${text.split("\n")[0]}`);
      if (!/Flytta till steg|Skapa offert/.test(text)) {
        problems.push(`${label}-popupen saknar stegväljare`);
      }
      if (kind === "QUOTE" && !/Offertrader/.test(text)) {
        problems.push("offert-popupen saknar offertrader");
      }
      if (/—\s*$/.test(text) && /Medlemmar i portalen\n—/.test(text)) {
        problems.push("popupen visar — för 0 medlemmar");
      }
      await page.screenshot({ path: `${OUT}/${file}` });
    } else {
      problems.push(`${label}-popupen öppnades inte vid klick`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }

  // Stegbyte via popupen (tangentbords-/touch-vägen till samma flytt).
  const quoteCard = page.locator('[data-deal-kind="QUOTE"][draggable="true"]');
  if (await quoteCard.count()) {
    const movedId = await quoteCard.first().getAttribute("data-deal-id");
    const from = await stageOf(page, movedId);
    await quoteCard.first().click();
    await page.waitForTimeout(2000);
    const targetLabel = from === "REJECTED" ? "Skickad" : "Nekad";
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: targetLabel, exact: true })
      .click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/07c-popup-stegbyte.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
    const after = await stageOf(page, movedId);
    const expected = targetLabel === "Nekad" ? "REJECTED" : "SENT";
    if (after === expected) {
      console.log(`✓ stegväljaren i popupen flyttade kortet ${from} → ${after}`);
    } else {
      problems.push(`stegväljaren landade i ${after}, förväntade ${expected}`);
    }
    // Återställ.
    await drag(page, movedId, from);
    await page.waitForTimeout(2000);
  }

  // ── Listvy ─────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Lista" }).click();
  await page.waitForTimeout(1200);
  const rows = page.locator("tbody tr");
  console.log(`✓ listvy med ${await rows.count()} rader`);
  await page.screenshot({ path: `${OUT}/08-listvy.png`, fullPage: true });

  await rows.first().click();
  await page.waitForTimeout(2500);
  if (await page.locator('[role="dialog"]').count()) {
    console.log("✓ radklick öppnar popupen");
    await page.screenshot({ path: `${OUT}/09-listvy-popup.png` });
  } else {
    problems.push("radklick i listvyn öppnade ingen popup");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // Vyvalet ska överleva en omladdning.
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2500);
  const listActive = await page
    .getByRole("button", { name: "Lista" })
    .getAttribute("aria-pressed");
  if (listActive === "true") {
    console.log("✓ vyvalet sparas över omladdning");
  } else {
    problems.push("vyvalet sparades inte");
  }
  await page.getByRole("button", { name: "Tavla" }).click();
  await page.waitForTimeout(800);

  // ── Lead → offert, hela vägen ──────────────────────────────────
  // Dra leadet till Utkast, fyll i dialogen och spara. Kortet ska lämna
  // LEAD och komma tillbaka som en offert i Utkast.
  const leadCard = page.locator('[data-deal-kind="LEAD"][draggable="true"]');
  if (await leadCard.count()) {
    const leadId = await leadCard.first().getAttribute("data-deal-id");
    const leadNameText = await leadCard.first().locator("p").first().innerText();
    await drag(page, leadId, "DRAFT");
    await page.waitForTimeout(1800);
    const dlg = page.locator('[role="dialog"]');
    await dlg.getByRole("button", { name: /^Öka/ }).first().click();
    await dlg.getByRole("button", { name: /^Öka/ }).first().click();
    await page.screenshot({ path: `${OUT}/06b-offert-fran-lead.png` });
    await dlg.getByRole("button", { name: "Spara utkast" }).click();
    await page.waitForTimeout(3000);

    const leadStillOnBoard = await stageOf(page, leadId);
    const draftCards = await page.$$eval(
      '[data-stage="DRAFT"] [data-deal-id]',
      (els) => els.map((e) => e.textContent)
    );
    const landedAsQuote = draftCards.some((t) => t?.includes(leadNameText));
    if (leadStillOnBoard === null && landedAsQuote) {
      console.log(
        `✓ lead → offert: "${leadNameText}" lämnade Lead och ligger nu i Utkast`
      );
    } else {
      problems.push(
        `lead → offert: leadkortet ${leadStillOnBoard ? `kvar i ${leadStillOnBoard}` : "borta"}, offert i Utkast: ${landedAsQuote}`
      );
    }
    await page.screenshot({ path: `${OUT}/06c-efter-offert.png`, fullPage: true });
  }

  // ── Mobil ──────────────────────────────────────────────────────
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "sv-SE",
    storageState: await ctx.storageState(),
  });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/portal/pipeline`, { waitUntil: "load", timeout: 40000 });
  await mp.addStyleTag({ content: HIDE_CHROME });
  await mp.waitForTimeout(2500);
  await mp.screenshot({ path: `${OUT}/10-mobil.png`, fullPage: true });
  // Desktop-tavlan ligger kvar i DOM:en men är `hidden` i mobilbredd —
  // scope:a därför till det som faktiskt syns.
  await mp.locator("[data-deal-id]:visible").first().click();
  await mp.waitForTimeout(2500);
  if (await mp.locator('[role="dialog"]').count()) {
    console.log("✓ mobil: kortklick öppnar popupen");
    await mp.screenshot({ path: `${OUT}/11-mobil-popup.png` });
  } else {
    problems.push("mobil: kortklick öppnade ingen popup");
  }

  await browser.close();

  console.log("\n─── resultat ───");
  const unique = [...new Set(problems)];
  if (unique.length === 0) console.log("inga fel");
  else for (const p of unique) console.log(`  ✗ ${p}`);
}

main().catch((err) => {
  console.error("FEL:", err.message);
  process.exit(1);
});
