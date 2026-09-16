/**
 * Personkörning mot roots.nu. Preview från Railway. Lösen från FILM_PASSWORD.
 * Klickar inte PAID på utbetalning och skickar inte Fortnox.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { BASE_URL, VIEWPORT, outDir } from "./config.js";
import { loadState } from "./state.js";
import { makeHelpers } from "./helpers.js";
import { openDb } from "./db.js";

const BUYER = {
  name: "Karin Holm",
  email: "karin.holm@film.roots.nu",
  phone: "0701234567",
};

function loadPreviewSecret() {
  if (process.env.SITE_PREVIEW_PASSWORD?.trim()) return;
  for (const service of ["web", "roots"]) {
    try {
      const raw = execFileSync(
        "railway",
        ["variables", "-s", service, "--json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      const parsed = JSON.parse(raw);
      const vars = parsed?.data || parsed?.variables || parsed;
      const pw =
        vars?.SITE_PREVIEW_PASSWORD ||
        vars?.find?.((v) => v.name === "SITE_PREVIEW_PASSWORD")?.value;
      if (pw) {
        process.env.SITE_PREVIEW_PASSWORD = pw;
        return;
      }
    } catch {
      /* ignore */
    }
  }
}

async function payStripe(page) {
  await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    document.querySelector('[data-testid="card-accordion-item-button"]')?.click();
  });
  const number = page.locator("#cardNumber");
  await number.waitFor({ state: "attached", timeout: 20000 });
  await page.waitForTimeout(400);
  await number.fill("4242424242424242");
  await page.locator("#cardExpiry").fill("1234");
  await page.locator("#cardCvc").fill("123");
  const name = page.locator("#billingName");
  if ((await name.count()) > 0) await name.fill(BUYER.name);
  const zip = page.locator("#billingPostalCode");
  if ((await zip.count()) > 0) await zip.fill("11122");

  await page.getByTestId("hosted-payment-submit-button").click();
  await page.waitForURL((url) => /roots\.nu/.test(url.hostname), {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
}

async function readOrderFromDb() {
  const sql = openDb();
  try {
    const [row] = await sql`
      SELECT id, status, total_ore, margin_percent_at_sale, customer_email
      FROM customer_orders
      WHERE customer_email = ${BUYER.email}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const [payout] = await sql`
      SELECT p.status, p.total_sales_ore, p.team_share_ore, p.roots_share_ore
      FROM payouts p
      JOIN organizations o ON o.id = p.org_id
      WHERE o.name = 'Roots FBK'
      ORDER BY p.created_at DESC
      LIMIT 1
    `;
    return { order: row || null, payout: payout || null };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  loadPreviewSecret();
  const password = process.env.FILM_PASSWORD?.trim();
  if (!process.env.SITE_PREVIEW_PASSWORD?.trim()) {
    throw new Error("SITE_PREVIEW_PASSWORD saknas.");
  }
  if (!password) throw new Error("FILM_PASSWORD måste vara satt.");

  const state = loadState("sv");
  if (!state?.shopSlug || !state.assocEmail) {
    throw new Error("Saknar state.json — kör reset-test-people.js --apply först.");
  }

  const report = {
    at: new Date().toISOString(),
    shop: state.shopSlug,
    steps: [],
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
    locale: "sv-SE",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("dialog", (d) => d.accept());
  const help = makeHelpers(page, () => {});

  try {
    await help.unlockPreview();
    report.steps.push("preview");

    await page.goto(`${BASE_URL}/shop/${state.shopSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await help.hideChrome();
    const add = page.getByRole("button", { name: /Lägg till/i }).first();
    await add.waitFor({ state: "visible", timeout: 20000 });
    await add.click();
    await page.waitForTimeout(400);
    await page.getByRole("link", { name: "Till kassan" }).first().click();
    await page.waitForURL("**/kassa**", { timeout: 20000 });
    await help.fillQuiet(page.locator("#name"), BUYER.name);
    await help.fillQuiet(page.locator("#email"), BUYER.email);
    await help.fillQuiet(page.locator("#phone"), BUYER.phone);
    const terms = page.locator('input[type="checkbox"][required]').first();
    await terms.check();
    await page.getByRole("button", { name: /Gå till betalning/i }).first().click();
    try {
      await payStripe(page);
    } catch (err) {
      const shot = path.join(outDir("sv"), "stripe-fail.png");
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      throw err;
    }
    report.steps.push("shop");

    await page.waitForTimeout(4000);
    let db = await readOrderFromDb();
    if (db.order?.status !== "PAID") {
      await page.waitForTimeout(6000);
      db = await readOrderFromDb();
    }
    report.order = db.order;
    if (db.order?.status !== "PAID") {
      throw new Error(`Order inte PAID (${db.order?.status || "saknas"}).`);
    }
    if (db.order.margin_percent_at_sale !== 35) {
      throw new Error(`Fel marginal ${db.order.margin_percent_at_sale}`);
    }
    report.steps.push("paid");

    const roles = [
      { key: "seller", email: state.sellerEmail, landing: "/min-shop", checks: ["/min-shop/statistik", "/min-shop/bestallningar"] },
      { key: "leader", email: state.leaderEmail, landing: "/lag", checks: ["/lag/statistik", "/lag/bestallningar"] },
      { key: "assoc", email: state.assocEmail, landing: "/forening", checks: ["/forening/statistik", "/forening/avrakning"] },
    ];

    for (const role of roles) {
      await help.loginQuiet(role.email, password, role.landing);
      await help.waitReady();
      await page.waitForTimeout(800);
      const body = (await page.locator("main").innerText().catch(() => "")) || "";
      report[role.key] = {
        url: page.url(),
        hasKarin: /Karin Holm|karin\.holm/i.test(body),
      };
      for (const href of role.checks) {
        await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
      }
      report.steps.push(role.key);
    }

    await page.goto(`${BASE_URL}/forening/avrakning`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(800);
    const endBtn = page.getByRole("button", { name: /Avsluta kampanj/i }).first();
    if (await endBtn.count()) {
      await endBtn.click();
      await page.waitForTimeout(1500);
      report.steps.push("ended");
    }
    const genBtn = page.getByRole("button", { name: /Generera avräkning|Skapa avräkning/i }).first();
    if (await genBtn.count()) {
      await genBtn.click();
      await page.waitForTimeout(2000);
      report.steps.push("settlement");
    } else {
      report.steps.push("settlement-missing");
    }

    db = await readOrderFromDb();
    report.payout = db.payout;
    if (db.payout && db.payout.status !== "PENDING") {
      throw new Error(`Payout status ${db.payout.status} — ska vara PENDING.`);
    }
    if (db.payout) report.steps.push("payout-pending");
  } finally {
    await browser.close();
  }

  const out = path.join(outDir("sv"), "personkorning-report.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Klar. steg=${report.steps.join(",")}`);
  if (report.order) {
    console.log(
      `order status=${report.order.status} total=${report.order.total_ore} margin=${report.order.margin_percent_at_sale}`
    );
  }
  if (report.payout) {
    console.log(
      `payout status=${report.payout.status} sales=${report.payout.total_sales_ore}`
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
