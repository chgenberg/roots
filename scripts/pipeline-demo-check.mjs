#!/usr/bin/env node
/**
 * Kontrollerar att pipeline-tavlan går i läsläge för demokonton.
 *
 * salj@roots.se är ett seedat demokonto, så PATCH /quotes/:id/status
 * svarar 403 i produktion. Utan läsläget bjuder tavlan in till ett drag
 * som alltid misslyckas — det ska se ut som en spärr, inte som en bugg.
 *
 * Kör API:t utan ROOTS_ALLOW_DEMO_WRITES för att härma produktion.
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3004";
const SHOTS = "/tmp/pipeline-demo-shots";
const fails = [];

function check(ok, label) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) fails.push(label);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
// Fälten är React-kontrollerade: fyll om tills värdet ligger kvar, annars
// hinner submit före hydreringen och formuläret postar tomt.
const email = page.locator('input[type="email"]');
const pw = page.locator('input[type="password"]');
await email.waitFor({ state: "visible", timeout: 15_000 });
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(400);
  await email.fill("salj@roots.se");
  await pw.fill("Demo1234!");
  if ((await email.inputValue()) === "salj@roots.se") break;
}
await Promise.all([
  page
    .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25_000 })
    .catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1200);
if (new URL(page.url()).pathname.startsWith("/login")) {
  throw new Error("inloggning misslyckades (rate limit? rensa rl:login i Redis)");
}

await page.goto(`${WEB}/portal/pipeline`, { waitUntil: "domcontentloaded" });
await page.locator("[data-deal-id]").first().waitFor({ timeout: 30_000 });
await page.screenshot({ path: `${SHOTS}/01-lasläge.png`, fullPage: true });

check(
  await page.getByText(/Demokonto/i).isVisible(),
  "tavlan förklarar att kontot är ett demokonto"
);

const draggable = await page
  .locator("[data-deal-id][draggable='true']")
  .count();
check(draggable === 0, `inga kort är dragbara (hittade ${draggable})`);

check(
  await page.getByRole("button", { name: /nytt lead/i }).isDisabled(),
  '"Nytt lead" är avstängd'
);

// Popupen ska visa affären men inte erbjuda stegbyte.
await page.locator("[data-deal-id]").first().click();
await page.getByRole("dialog").waitFor({ timeout: 15_000 });
await page.screenshot({ path: `${SHOTS}/02-popup-lasläge.png` });
const dialog = page.getByRole("dialog");
check(
  await dialog.getByText(/kan inte ändra dem/i).isVisible(),
  "popupen förklarar läsläget"
);
check(
  (await dialog.getByRole("button", { name: /^Skickad$/ }).count()) === 0,
  "popupen visar inga stegknappar"
);

// Serversidan ska vara spärren, inte bara UI:t.
const res = await page.evaluate(async () => {
  const id = document.querySelector("[data-deal-kind='QUOTE']")?.getAttribute("data-deal-id");
  if (!id) return { status: 0 };
  const r = await fetch(`/api/v1/portal/quotes/${id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "ACCEPTED" }),
    credentials: "include",
  });
  return { status: r.status };
});
check(res.status === 403, `API nekar flytten direkt (status ${res.status})`);

console.log(`\n─── resultat ───\n${fails.length === 0 ? "inga fel" : fails.join("\n")}`);
await browser.close();
process.exit(fails.length === 0 ? 0 : 1);
