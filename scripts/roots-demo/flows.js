// De tre rollflödena. Varje flöde får en `ctx` med sidan + mänskliga
// hjälpare (tap/type/softScroll/navTo) och loggar en tidsmarkör vid varje
// "beat" som compose.js sedan rampar hastigheten kring.
//
// Flödena är defensiva: ett saknat element (t.ex. en kampanjknapp som bytt
// namn) loggar en varning och hoppar vidare i stället för att krascha hela
// tagningen — markören sätts ändå så klippningen håller ihop.
import {
  BASE_URL,
  REC_CAMPAIGN_NAME,
  REC_CHAT_BODY,
  REC_ORDER_CUSTOMER,
} from "./config.js";

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ⚠ beat "${label}" hoppades över: ${err.message}`);
  }
}

// ── Säljare / medlem → /min-shop ─────────────────────────────────────
export async function sellerFlow(ctx) {
  const { page, mark, tap, type, navTo, softScrollTo, pause } = ctx;

  await ctx.login();
  await pause(1200);
  await mark("dashboardShown");
  await pause(900);

  await safe("share", async () => {
    // "Dela din shop" är en CardTitle (ej semantisk heading) → getByText.
    const dela = page.getByText("Dela din shop", { exact: true });
    await softScrollTo(dela);
    await mark("shareShown");
    await pause(900);
  });

  await safe("shareTap", async () => {
    const btn = page.getByRole("button", {
      name: "Dela via SMS/sociala medier",
    });
    if (await btn.count()) await tap(btn.first());
    await mark("shareTapped");
    await pause(600);
  });

  await safe("manualOrder", async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(400);
    const open = page.getByRole("button", { name: "Registrera order" }).first();
    await tap(open);
    await page
      .getByRole("heading", { name: "Registrera order" })
      .waitFor({ timeout: 6000 });
    await pause(500);
    const plus = page.getByRole("button", { name: /^Öka / }).first();
    if (await plus.count()) {
      await tap(plus);
      await pause(250);
      await tap(plus);
      await pause(250);
    }
    const swish = page.getByRole("button", { name: "Swish" }).first();
    if (await swish.count()) await tap(swish);
    await pause(300);
    // Markör för städning: gör ordern igenkännbar i DB.
    const nameField = page.getByPlaceholder("T.ex. Granne Karin").first();
    if (await nameField.count()) await type(nameField, REC_ORDER_CUSTOMER);
    await pause(400);
    const submit = page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "Registrera order" });
    if (await submit.count()) await tap(submit.last());
    await mark("orderRegistered");
    await pause(900);
    await page.keyboard.press("Escape").catch(() => {});
  });

  await safe("stats", async () => {
    await navTo("Statistik");
    await page
      .getByRole("heading", { name: "Min statistik" })
      .waitFor({ timeout: 6000 });
    await mark("statsShown");
    await pause(700);
    await softScrollTo(page.getByText("Mot målet").first());
    await pause(900);
  });
}

// ── Förening → /forening ─────────────────────────────────────────────
export async function foreningFlow(ctx) {
  const { page, mark, tap, type, navTo, softScrollTo, pause } = ctx;

  await ctx.login();
  await pause(1200);
  await mark("dashboardShown");
  await pause(900);

  await safe("campaignForm", async () => {
    const open = page
      .getByRole("button", { name: /Starta kampanj|Ny kampanj/ })
      .first();
    await tap(open);
    await page
      .getByRole("heading", { name: /Starta ny kampanj/ })
      .waitFor({ timeout: 6000 });
    await pause(400);
    await type(page.locator("#campaignName"), REC_CAMPAIGN_NAME);
    await pause(250);
    const goal = page.locator("#goalValue");
    if (await goal.count()) {
      await goal.fill("");
      await type(goal, "60000");
    }
    await mark("campaignFormFilled");
    await pause(500);
  });

  await safe("campaignCreate", async () => {
    const submit = page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "Starta kampanj" });
    if (await submit.count()) await tap(submit.last());
    await mark("campaignCreated");
    await pause(1100);
    await page.keyboard.press("Escape").catch(() => {});
  });

  await safe("teams", async () => {
    await navTo("Lag");
    await page.getByRole("heading", { name: "Lag" }).first().waitFor({ timeout: 6000 });
    await mark("teamsShown");
    await pause(700);
    const invite = page.getByText("Inbjudningslänk för säljare").first();
    if (await invite.count()) await softScrollTo(invite);
    await pause(700);
  });

  await safe("settlement", async () => {
    await navTo("Avräkning");
    await page
      .getByRole("heading", { name: /Avräkning/ })
      .first()
      .waitFor({ timeout: 6000 })
      .catch(() => {});
    await mark("settlementShown");
    await pause(900);
    await softScrollTo(page.getByText("Per lag").first()).catch(() => {});
    await pause(700);
  });

  await safe("stats", async () => {
    await navTo("Statistik");
    await page
      .getByRole("heading", { name: "Statistik" })
      .first()
      .waitFor({ timeout: 6000 })
      .catch(() => {});
    await mark("statsShown");
    await pause(800);
    await softScrollTo(page.getByText("Topplista — lag").first()).catch(
      () => {}
    );
    await pause(900);
  });
}

// ── Publik räknesnurra → /sa-fungerar-det (ingen inloggning) ─────────
export async function calculatorFlow(ctx) {
  const { page, mark, softScrollTo, pause, hideChrome } = ctx;

  await page.goto(`${BASE_URL}/sa-fungerar-det`, {
    waitUntil: "domcontentloaded",
  });
  // Dölj chatt-knapp + ev. dev-indikator (marknadssidan har chatt-knappen).
  await hideChrome();
  await pause(900);

  // Hoppa direkt till kalkylator-sektionen (förbi demo-filmerna ovan).
  await safe("toCalc", async () => {
    const heading = page.getByRole("heading", {
      name: "Vad kan er förening tjäna?",
    });
    await heading.waitFor({ timeout: 8000 });
    await softScrollTo(heading);
    await pause(700);
    await softScrollTo(page.getByText("Antal säljare").first());
    await mark("calcShown");
    await pause(800);
  });

  // Sätt realistiska antaganden via sifferfälten (reglagen följer med).
  // Sifferfälten har role=spinbutton: 0=säljare, 1=snitt, 2=marginal, 3=mål.
  const setNumber = async (index, value) => {
    const field = page.getByRole("spinbutton").nth(index);
    if (!(await field.count())) return;
    await field.scrollIntoViewIfNeeded().catch(() => {});
    await field.click({ clickCount: 3 }).catch(() => {});
    await field.pressSequentially(String(value), { delay: 90 });
    await pause(450);
  };

  await safe("values", async () => {
    await setNumber(0, 40); // antal säljare
    await setNumber(1, 2000); // snittförsäljning per säljare
    await mark("valuesSet");
    await pause(700);
  });

  await safe("earnings", async () => {
    await softScrollTo(page.getByText("Föreningens förtjänst").first());
    await mark("earningsShown");
    await pause(1000);
  });

  await safe("goal", async () => {
    await setNumber(3, 25000); // mål: insamlat belopp → mätaren fylls
    await pause(400);
    // Scrolla längst ner till mätaren (GoalGauge) + disclaimer.
    await softScrollTo(
      page.getByText("Uppskattning baserad", { exact: false }).first()
    ).catch(() => {});
    await mark("goalShown");
    await pause(1200);
  });
}

// ── Lagledare / klubbledare → /lag ───────────────────────────────────
export async function lagFlow(ctx) {
  const { page, mark, tap, type, navTo, softScrollTo, pause } = ctx;

  await ctx.login();
  await pause(1200);
  await mark("dashboardShown");
  await pause(900);

  await safe("invite", async () => {
    const invite = page
      .getByText("Skicka denna länk till dina spelare")
      .first();
    if (await invite.count()) await softScrollTo(invite);
    await mark("inviteShown");
    await pause(800);
  });

  await safe("import", async () => {
    await navTo("Säljare");
    await page.getByRole("button", { name: "Importera" }).first().waitFor({ timeout: 6000 });
    await pause(300);
    await tap(page.getByRole("button", { name: "Importera" }).first());
    await page
      .getByRole("heading", { name: "Importera säljare från fil" })
      .waitFor({ timeout: 6000 });
    await mark("importShown");
    await pause(1000);
    await page.keyboard.press("Escape").catch(() => {});
  });

  await safe("broadcast", async () => {
    await navTo("Chatt");
    await pause(400);
    const all = page.getByRole("button", { name: "Meddela hela laget" }).first();
    if (await all.count()) await tap(all);
    await pause(400);
    const box = page
      .getByPlaceholder("T.ex. Kom ihåg att säljperioden slutar på söndag!")
      .first();
    if (await box.count()) await type(box, REC_CHAT_BODY);
    await pause(300);
    const send = page.getByRole("button", { name: "Skicka till alla" }).first();
    if ((await send.count()) && (await send.isEnabled().catch(() => false))) {
      await tap(send);
    }
    await mark("broadcastSent");
    await pause(900);
  });

  await safe("stats", async () => {
    await navTo("Statistik");
    await page
      .getByRole("heading", { name: "Lagets statistik" })
      .waitFor({ timeout: 6000 });
    await mark("statsShown");
    await pause(700);
    await softScrollTo(page.getByText("Topplista — säljare").first()).catch(
      () => {}
    );
    await pause(800);
  });
}

export const FLOWS = {
  seller: sellerFlow,
  forening: foreningFlow,
  lag: lagFlow,
  calculator: calculatorFlow,
};
