import { BASE_URL } from "./config.js";
import { ensureFilmIdentity } from "./state.js";
import { safe } from "./helpers.js";

export async function chapterOverview(ctx) {
  const { page, showTitle, softScrollTo, pause, gotoPath, waitReady } = ctx;

  await showTitle("Föreningens hem");
  await gotoPath("/forening");
  await waitReady();
  await pause(1600);
  await softScrollTo(page.getByText(/Total försäljning|försäljningstrend/i).first());
  await pause(1400);
  await softScrollTo(page.getByText(/Lag-ranking|Hantera lag|P14 Blå/i).first());
  await pause(1600);
}

export async function chapterGoals(ctx) {
  const { page, showTitle, click, typeSlow, pause, gotoPath, waitReady } = ctx;

  await showTitle("Sätt lagets mål");
  await gotoPath("/forening/mal");
  await waitReady();
  await pause(900);

  await safe("andraMal", async () => {
    await click(page.getByRole("button", { name: "Ändra mål" }));
    const input = page.locator('input[type="number"]').first();
    await typeSlow(input, "40000");
    await pause(350);
    await click(page.getByRole("button", { name: "Spara" }));
    await page
      .getByText(/Målet är uppdaterat/i)
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => {});
    await pause(2000);
  });
}

export async function chapterAssociation(ctx) {
  const { page, showTitle, navTo, softScrollTo, pause, waitReady } = ctx;

  await showTitle("Så följer ni statistiken");
  await navTo("Statistik", "/forening/statistik");
  await waitReady();
  await pause(1400);
  await softScrollTo(page.locator("main").last());
  await pause(1200);

  await navTo("Avräkning", "/forening/avrakning");
  await waitReady();
  await pause(1600);

  await navTo("Lag", "/forening/lag");
  await waitReady();
  await pause(1200);
}

export async function chapterLeader(ctx) {
  const { page, showTitle, navTo, softScrollTo, pause, gotoPath, waitReady } =
    ctx;

  await showTitle("Lagkaptenens översikt");
  await gotoPath("/lag");
  await waitReady();
  await pause(1800);
  await softScrollTo(page.getByText(/Total försäljning|försäljningstrend/i).first());
  await pause(1200);
  await softScrollTo(page.getByText(/Maja Svensson|Topplista|säljare/i).first());
  await pause(1400);

  await navTo("Statistik", "/lag/statistik");
  await waitReady();
  await pause(1500);
  await softScrollTo(page.locator("main").last());
  await pause(900);

  await navTo("Säljare", "/lag/saljare");
  await waitReady();
  await pause(1400);

  await navTo("Beställningar", "/lag/bestallningar");
  await waitReady();
  await pause(1500);

  await navTo("Chatt", "/lag/chatt");
  await waitReady();
  await pause(1100);
}

export async function chapterSeller(ctx) {
  const { page, showTitle, navTo, softScrollTo, pause, gotoPath, waitReady } =
    ctx;

  await showTitle("Säljarens dashboard");
  await gotoPath("/min-shop");
  await waitReady();
  await pause(1800);
  await softScrollTo(page.getByText(/Dela din shop|Din länk|QR/i).first());
  await pause(1600);
  await softScrollTo(page.getByText(/sålt|uppskattad|beställningar/i).first());
  await pause(1200);

  await navTo("Statistik", "/min-shop/statistik");
  await waitReady();
  await pause(1500);
  await softScrollTo(page.locator("main").last());
  await pause(900);

  await navTo("Beställningar", "/min-shop/bestallningar");
  await waitReady();
  await pause(1600);
}

export async function chapterShop(ctx) {
  const { page, showTitle, click, typeSlow, pause, hideChrome } = ctx;
  const id = ensureFilmIdentity();
  if (!id.shopSlug) {
    throw new Error("Saknar shopSlug i state.json");
  }

  await showTitle("Kunden handlar");
  await page.goto(`${BASE_URL}/shop/${id.shopSlug}`, {
    waitUntil: "domcontentloaded",
  });
  await hideChrome();
  await pause(1400);
  await page
    .getByRole("heading", { name: /Produkter/i })
    .first()
    .waitFor({ timeout: 12000 })
    .catch(() => {});
  await pause(800);

  const adds = page.getByRole("button", { name: /Lägg till/ });
  const n = await adds.count();
  if (n > 0) {
    await click(adds.nth(0));
    await pause(500);
    if (n > 1) await click(adds.nth(1));
    else await click(adds.nth(0));
    await pause(900);
  }

  const checkout = page.getByRole("link", { name: "Till kassan" }).first();
  if (await checkout.count()) await click(checkout);
  await page.waitForURL("**/kassa**", { timeout: 15000 }).catch(() => {});
  await hideChrome();
  await pause(900);

  await safe("kassaUppgifter", async () => {
    await typeSlow(page.locator("#name"), "Karin Holm");
    await pause(200);
    await typeSlow(page.locator("#email"), "karin.holm@example.com");
    await pause(200);
    await typeSlow(page.locator("#phone"), "0701234567");
    await pause(1800);
  });
}

export const CHAPTER_FNS = {
  overview: chapterOverview,
  goals: chapterGoals,
  association: chapterAssociation,
  leader: chapterLeader,
  seller: chapterSeller,
  shop: chapterShop,
};
