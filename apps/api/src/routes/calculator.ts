import { Hono } from "hono";
import { and, eq, ne, sql, asc, inArray } from "drizzle-orm";
import { db } from "@roots/db";
import {
  calculatorLinks,
  calculatorLeads,
  products,
  users,
} from "@roots/db/schema";
import {
  CalculatorLeadSchema,
  CalculatorInputsSchema,
  CALCULATOR_DEFAULTS,
  computeCalculator,
  BUNDLE_SLUG,
  type CalculatorInputs,
} from "@roots/contracts";
import { calculatorLeadRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import { localizeZodFlatten } from "../lib/zod-i18n";
import { localizedProductName } from "../lib/product-i18n";

const log = childLogger("calculator");

/**
 * Priserna som kalkylatorn räknar snitt på.
 *
 * Paketet utesluts. Kalkylen skriver "en produkt kostar i snitt X kr", och
 * paketet är tre produkter till rabatterat pris — det skulle dra snittet till
 * ett belopp som ingen enskild flaska kostar.
 */
function singleProductPrices() {
  return db
    .select({
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      priceOre: products.priceOre,
    })
    .from(products)
    .where(and(eq(products.active, true), ne(products.slug, BUNDLE_SLUG)));
}

export const calculator = new Hono();

/**
 * Den öppna "Så fungerar det"-kalkylatorn på publika sajten delar
 * lead-pipeline med säljarnas delade länkar. Istället för att införa en
 * nullable FK + separat admin-vy lagrar vi webb-leads mot en enda
 * sentinel-länk med ett fast token. Då dyker de upp i exakt samma
 * notisfeed och admin-lista som vanliga kalkyl-leads, utan migration.
 */
const PUBLIC_LINK_TOKEN = "webbplats-publik";
/** Canonical DB label for the public website calculator sentinel link. */
const PUBLIC_LINK_NAME_SV = "Öppen kalkylator (webbplatsen)";
const PUBLIC_LINK_NAME_EN = "Open calculator (website)";

function displayPublicLinkName(
  stored: string,
  locale: "sv" | "en"
): string {
  if (
    locale === "en" &&
    (stored === PUBLIC_LINK_NAME_SV || stored === PUBLIC_LINK_NAME_EN)
  ) {
    return PUBLIC_LINK_NAME_EN;
  }
  return stored;
}

let cachedPublicLinkId: string | null = null;

async function getOrCreatePublicLink(): Promise<{ id: string } | null> {
  if (cachedPublicLinkId) return { id: cachedPublicLinkId };

  const [existing] = await db
    .select({ id: calculatorLinks.id })
    .from(calculatorLinks)
    .where(eq(calculatorLinks.token, PUBLIC_LINK_TOKEN))
    .limit(1);
  if (existing) {
    cachedPublicLinkId = existing.id;
    return existing;
  }

  // Ägs av tidigaste interna/sälj-användaren så admins ser leadsen.
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ["INTERNAL_ADMIN", "SALES_ADMIN", "SALES_REP"]))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!owner) return null;

  try {
    const [created] = await db
      .insert(calculatorLinks)
      .values({
        token: PUBLIC_LINK_TOKEN,
        createdByUserId: owner.id,
        associationName: PUBLIC_LINK_NAME_SV,
        presets: CALCULATOR_DEFAULTS,
      })
      .onConflictDoNothing({ target: calculatorLinks.token })
      .returning({ id: calculatorLinks.id });
    if (created) {
      cachedPublicLinkId = created.id;
      return created;
    }
  } catch (err) {
    log.warn({ err }, "public calculator link create raced");
  }

  // Konflikt (samtidig skapare) → läs raden som vann.
  const [row] = await db
    .select({ id: calculatorLinks.id })
    .from(calculatorLinks)
    .where(eq(calculatorLinks.token, PUBLIC_LINK_TOKEN))
    .limit(1);
  if (row) cachedPublicLinkId = row.id;
  return row ?? null;
}

// ── Publik: öppen kalkylator (lead-magnet på sajten) ───────────────
calculator.get("/public", async (c) => {
  try {
    const link = await getOrCreatePublicLink();
    if (link) {
      db.update(calculatorLinks)
        .set({
          viewCount: sql`${calculatorLinks.viewCount} + 1`,
          lastViewedAt: new Date(),
        })
        .where(eq(calculatorLinks.id, link.id))
        .catch((err) => log.warn({ err }, "public view count bump failed"));
    }

    const priceRows = await singleProductPrices();

    return c.json({
      presets: CALCULATOR_DEFAULTS,
      products: priceRows.map((p) => ({ name: p.name, priceOre: p.priceOre })),
    });
  } catch (err) {
    log.error({ err }, "public calculator fetch failed");
    return c.json(
      { error: uiError(resolveUiLocale(c), "calculatorFetchFailed") },
      500
    );
  }
});

calculator.post("/public/lead", async (c) => {
  const locale = resolveUiLocale(c);
  const ip = clientIp(c);
  const rl = await calculatorLeadRateLimit(ip);
  if (!rl.allowed) {
    return c.json(
      {
        error: uiError(
          locale,
          rl.degraded ? "serviceOverloaded" : "tooManyRequests"
        ),
        retryAfter: rl.resetInSeconds,
      },
      429
    );
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJsonShort") }, 400);
  }

  const bodyLocale =
    raw && typeof raw === "object" && "locale" in raw
      ? (raw as { locale?: unknown }).locale
      : undefined;
  const resolved = resolveUiLocale(c, bodyLocale);

  const parsed = CalculatorLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        error: uiError(resolved, "invalidFields"),
        issues: localizeZodFlatten(parsed.error.flatten(), resolved),
      },
      400
    );
  }

  try {
    const link = await getOrCreatePublicLink();
    if (!link) {
      return c.json({ error: uiError(resolved, "leadNotConfigured") }, 503);
    }

    const result = computeCalculator(parsed.data.inputs as CalculatorInputs);
    const idempotencyKey =
      c.req.header("idempotency-key") || parsed.data.idempotencyKey || undefined;

    await db.insert(calculatorLeads).values({
      calculatorLinkId: link.id,
      email: parsed.data.email,
      contactName: parsed.data.contactName,
      message: parsed.data.message,
      inputsSnapshot: parsed.data.inputs,
      computedEarningsOre: Math.round(result.earningsKr * 100),
      newsletterConsent: parsed.data.newsletterConsent ?? false,
      ipAddress: ip,
      idempotencyKey,
    });

    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && /duplicate key|unique/i.test(err.message)) {
      return c.json({ ok: true, deduped: true });
    }
    log.error({ err }, "public calculator lead save failed");
    return c.json({ error: uiError(resolved, "sendFailedRetry") }, 500);
  }
});

function clientIp(c: {
  req: { header: (n: string) => string | undefined };
}): string {
  const xf = c.req.header("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return c.req.header("x-real-ip") || "unknown";
}

// ── Publik: hämta kalkyl-länkens antaganden + produktkontext ───────
calculator.get("/by-token/:token", async (c) => {
  const locale = resolveUiLocale(c);
  const token = c.req.param("token");
  if (!token || token.length < 8) {
    return c.json({ error: uiError(locale, "invalidLink") }, 400);
  }

  try {
    const [link] = await db
      .select()
      .from(calculatorLinks)
      .where(eq(calculatorLinks.token, token))
      .limit(1);

    if (!link) {
      return c.json({ error: uiError(locale, "calculatorNotFound") }, 404);
    }

    // Best-effort visningsräknare — får aldrig blocka svaret.
    db.update(calculatorLinks)
      .set({
        viewCount: sql`${calculatorLinks.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(calculatorLinks.id, link.id))
      .catch((err) => log.warn({ err }, "view count bump failed"));

    const presets = CalculatorInputsSchema.safeParse(link.presets);

    const priceRows = await singleProductPrices();

    return c.json({
      associationName: displayPublicLinkName(link.associationName, locale),
      presets: presets.success ? presets.data : null,
      products: priceRows.map((p) => ({
        name: localizedProductName(locale, {
          slug: p.slug,
          sku: p.sku,
          fallback: p.name,
        }),
        priceOre: p.priceOre,
      })),
    });
  } catch (err) {
    log.error({ err }, "calculator by-token failed");
    return c.json({ error: uiError(locale, "calculatorFetchFailed") }, 500);
  }
});

// ── Publik: mjuk lead-capture ──────────────────────────────────────
calculator.post("/by-token/:token/lead", async (c) => {
  const locale = resolveUiLocale(c);
  const token = c.req.param("token");

  const ip = clientIp(c);
  const rl = await calculatorLeadRateLimit(ip);
  if (!rl.allowed) {
    return c.json(
      {
        error: uiError(
          locale,
          rl.degraded ? "serviceOverloaded" : "tooManyRequests"
        ),
        retryAfter: rl.resetInSeconds,
      },
      429
    );
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJsonShort") }, 400);
  }

  const bodyLocale =
    raw && typeof raw === "object" && "locale" in raw
      ? (raw as { locale?: unknown }).locale
      : undefined;
  const resolved = resolveUiLocale(c, bodyLocale);

  const parsed = CalculatorLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        error: uiError(resolved, "invalidFields"),
        issues: localizeZodFlatten(parsed.error.flatten(), resolved),
      },
      400
    );
  }

  try {
    const [link] = await db
      .select({ id: calculatorLinks.id })
      .from(calculatorLinks)
      .where(eq(calculatorLinks.token, token))
      .limit(1);

    if (!link) {
      return c.json({ error: uiError(resolved, "calculatorNotFound") }, 404);
    }

    const result = computeCalculator(parsed.data.inputs as CalculatorInputs);
    const idempotencyKey =
      c.req.header("idempotency-key") || parsed.data.idempotencyKey || undefined;

    await db.insert(calculatorLeads).values({
      calculatorLinkId: link.id,
      email: parsed.data.email,
      contactName: parsed.data.contactName,
      message: parsed.data.message,
      inputsSnapshot: parsed.data.inputs,
      computedEarningsOre: Math.round(result.earningsKr * 100),
      newsletterConsent: parsed.data.newsletterConsent ?? false,
      ipAddress: ip,
      idempotencyKey,
    });

    return c.json({ ok: true });
  } catch (err) {
    // Idempotency-konflikt → behandla som lyckad (dubbelklick/retry).
    if (
      err instanceof Error &&
      /duplicate key|unique/i.test(err.message)
    ) {
      return c.json({ ok: true, deduped: true });
    }
    log.error({ err }, "calculator lead save failed");
    return c.json({ error: uiError(resolved, "sendFailedRetry") }, 500);
  }
});
