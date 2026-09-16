/**
 * Verifierar luckorna mot roots.nu. Klickar inte PAID och skickar inte Fortnox.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { BASE_URL, VIEWPORT, outDir } from "./config.js";
import { loadState } from "./state.js";
import { makeHelpers } from "./helpers.js";
import { openDb } from "./db.js";
import { totpFromSecret } from "./totp.js";

const INTERN_EMAIL = "walk.intern.mt7s7hmq@roots.nu";

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

async function readDb() {
  const sql = openDb();
  try {
    const orders = await sql`
      SELECT id, status, customer_name
      FROM customer_orders
      WHERE customer_email = 'karin.holm@film.roots.nu'
      ORDER BY created_at DESC
    `;
    const [campaign] = await sql`
      SELECT c.status
      FROM campaigns c
      JOIN organizations o ON o.id = c.org_id
      WHERE o.name = 'Roots FBK'
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    const [payout] = await sql`
      SELECT p.status
      FROM payouts p
      JOIN organizations o ON o.id = p.org_id
      WHERE o.name = 'Roots FBK'
      ORDER BY p.created_at DESC
      LIMIT 1
    `;
    const [intern] = await sql`
      SELECT email, role, (mfa_enabled_at IS NOT NULL) AS mfa
      FROM users
      WHERE email = ${INTERN_EMAIL}
      LIMIT 1
    `;
    const cards = await sql`
      SELECT title, status, gate
      FROM orchestrator_cards
      WHERE source = 'admin'
      ORDER BY created_at DESC
      LIMIT 8
    `.catch(() => []);
    return { orders, campaign, payout, intern, cards };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function resetInternMfa() {
  const sql = openDb();
  try {
    await sql`
      UPDATE users
      SET mfa_secret = NULL,
          mfa_enabled_at = NULL,
          mfa_backup_codes = NULL,
          updated_at = NOW()
      WHERE email = ${INTERN_EMAIL}
        AND role = 'INTERNAL_ADMIN'
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function enrollMfa(page, password) {
  await page.goto(`${BASE_URL}/portal/installningar`, {
    waitUntil: "domcontentloaded",
  });
  const pw = page.locator("#mfa-password");
  await pw.waitFor({ state: "visible", timeout: 20000 });
  await pw.fill(password);
  await page.getByRole("button", { name: /Kom igång/i }).click();
  const secretEl = page.locator("code").first();
  await secretEl.waitFor({ state: "visible", timeout: 20000 });
  const secret = (await secretEl.innerText()).replace(/\s+/g, "");
  await page.locator("#mfa-confirm").fill(totpFromSecret(secret));
  await page.getByRole("button", { name: /Aktivera tvåfaktor/i }).click();
  await page
    .getByText(/Tvåfaktor är aktiverad|Spara dina reservkoder/i)
    .first()
    .waitFor({ timeout: 20000 });
  return secret;
}

async function loginWithMfa(page, help, email, password, secret) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await help.hideChrome();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Logga in" }).first().click();
  const codeField = page.locator("#mfa-code");
  await codeField.waitFor({ state: "visible", timeout: 20000 });
  await codeField.fill(totpFromSecret(secret));
  await page.getByRole("button", { name: /Fortsätt/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20000,
  });
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
    steps: [],
  };

  const dbBefore = await readDb();
  report.db = {
    karinPaid: dbBefore.orders.some((o) => o.status === "PAID"),
    karinPending: dbBefore.orders.filter((o) => o.status === "PENDING").length,
    campaign: dbBefore.campaign?.status || null,
    payout: dbBefore.payout?.status || null,
    intern: dbBefore.intern
      ? { role: dbBefore.intern.role, mfa: dbBefore.intern.mfa }
      : null,
    cards: dbBefore.cards.length,
  };
  if (report.db.karinPending > 0) {
    throw new Error("PENDING-kassor finns kvar.");
  }
  if (report.db.campaign !== "ACTIVE") {
    throw new Error(`Kampanj är ${report.db.campaign}, ska vara ACTIVE.`);
  }
  if (report.db.payout && report.db.payout !== "PENDING") {
    throw new Error(`Payout ${report.db.payout} — ska vara PENDING.`);
  }
  if (!dbBefore.intern || dbBefore.intern.role !== "INTERNAL_ADMIN") {
    throw new Error("Test-intern saknas.");
  }

  await resetInternMfa();

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
    report.shopOpen = true;
    report.steps.push("shop-open");

    await help.loginQuiet(state.sellerEmail, password, "/min-shop");
    await help.waitReady();
    await page.goto(`${BASE_URL}/min-shop/bestallningar`, {
      waitUntil: "domcontentloaded",
    });
    await help.waitReady();
    await page.waitForTimeout(1200);
    const sellerBody = (await page.locator("main").innerText().catch(() => "")) || "";
    report.sellerHasKarin = /Karin Holm/i.test(sellerBody);
    report.steps.push("seller");

    await help.loginQuiet(state.assocEmail, password, "/forening");
    await help.waitReady();
    const assocBody = (await page.locator("main").innerText().catch(() => "")) || "";
    report.assocHasKarin = /Karin Holm/i.test(assocBody);
    report.steps.push("assoc");

    await help.loginQuiet(INTERN_EMAIL, password, "/portal/installningar");
    await help.waitReady();
    if (page.url().includes("/login")) {
      throw new Error("Intern-inloggning stannade på login.");
    }
    const secret = await enrollMfa(page, password);
    report.steps.push("intern-mfa");

    await context.clearCookies();
    await help.unlockPreview();
    await loginWithMfa(page, help, INTERN_EMAIL, password, secret);
    // Session-sync cachar mfaEnabled 30 s per API-process.
    await page.waitForTimeout(35000);
    await page.goto(`${BASE_URL}/portal/agenten`, {
      waitUntil: "domcontentloaded",
    });
    await help.waitReady();
    await page.waitForTimeout(1500);
    const board = (await page.locator("main").innerText().catch(() => "")) || "";
    report.intern = {
      url: page.url(),
      hasRing: /Förening|Orderliv|Pengar|Mejl|Drift/i.test(board),
      locked: /Aktivera tvåfaktor för att fortsätta/i.test(board),
    };
    if (!report.intern.hasRing) {
      throw new Error("Intern såg inte ringen.");
    }
    if (report.intern.locked) {
      throw new Error("Portalen är fortfarande låst bakom tvåfaktor.");
    }
    report.steps.push("intern-board");
  } catch (err) {
    report.error = err.message;
    throw err;
  } finally {
    await browser.close();
    const out = path.join(outDir("sv"), "person-luckor-report.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
  }

  console.log(`Klar. steg=${report.steps.join(",")}`);
  console.log(
    `shopOpen=${report.shopOpen} sellerKarin=${report.sellerHasKarin} assocKarin=${report.assocHasKarin} ring=${report.intern?.hasRing}`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
