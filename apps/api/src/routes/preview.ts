/**
 * Pre-launch password gate + waitlist capture.
 *
 *   POST /v1/preview/unlock   — verify password, set the gate cookie
 *   POST /v1/preview/waitlist — capture an email for the launch list
 *
 * Both endpoints are intentionally CSRF-exempt (registered in app.ts)
 * because the gate page is served before the user has had a chance to
 * fetch a CSRF token from /v1/csrf-token. They are protected instead
 * by tight rate-limits and a strict input schema.
 */

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, waitlistSignups } from "@roots/db";
import { organizations } from "@roots/db/schema";
import {
  INTEREST_CUSTOMER_TYPES,
  INTEREST_INTENTS,
  INTEREST_TRACKING_KEYS,
  normalizeInterestPhone,
  type InterestCustomerType,
  type InterestIntent,
  type InterestTracking,
} from "@roots/contracts";
import { auditLog, requestContext } from "../lib/audit";
import { childLogger } from "../lib/logger";
import { checkRateLimit } from "../lib/rate-limit";
import {
  PREVIEW_COOKIE_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_NAME,
  getPreviewPassword,
  getPreviewToken,
  isPreviewGateDisabled,
} from "../lib/preview-gate";
import { resolveUiLocale, uiError } from "../lib/ui-locale";

const log = childLogger("preview-gate");

export const preview = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(c: { req: { header: (k: string) => string | undefined } }): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return c.req.header("x-real-ip") || "unknown";
}

preview.post("/unlock", async (c) => {
  // P1.7: när gaten är avstängd ska unlock inte kunna sätta cookie
  // (skulle vara ett verkningslöst men förvirrande API-anrop) och
  // när SITE_PREVIEW_PASSWORD saknas ska vi fail:a tydligt 503
  // istället för att jämföra mot ett tomt strängvärde.
  if (isPreviewGateDisabled()) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "gateDisabled") },
      410
    );
  }

  let body: { password?: unknown; locale?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidFormat") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return c.json({ error: uiError(locale, "enterPassword") }, 400);
  }

  // Brute-force budget: 20 attempts per IP per hour. Generous enough
  // for a fat-fingered investor, tight enough that a script can't
  // exhaust a 6-character alphabet in any reasonable time.
  const ip = getClientIp(c);
  const rl = await checkRateLimit(`preview-unlock:${ip}`, 20, 3600);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }

  let expectedPassword: string;
  let cookieToken: string;
  try {
    expectedPassword = getPreviewPassword();
    cookieToken = getPreviewToken(expectedPassword);
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "preview-gate: misconfigured — refusing unlock"
    );
    return c.json({ error: uiError(locale, "previewMisconfigured") }, 503);
  }

  if (password !== expectedPassword) {
    log.info({ ip }, "preview-gate: failed unlock attempt");
    return c.json({ error: uiError(locale, "wrongPassword") }, 401);
  }

  // Set the gate cookie. HttpOnly so client JS can't read it (less
  // useful for the attacker than a session cookie, but still good
  // hygiene). SameSite=Lax allows direct-link visits to set-cookie
  // on the first GET after the POST redirect.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  c.header(
    "Set-Cookie",
    `${PREVIEW_COOKIE_NAME}=${cookieToken}; Path=/; Max-Age=${PREVIEW_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`
  );

  return c.json({ ok: true });
});

function readTracking(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const out: InterestTracking = {};
  for (const key of INTEREST_TRACKING_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 300);
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

preview.post("/waitlist", async (c) => {
  let body: {
    email?: unknown;
    name?: unknown;
    locale?: unknown;
    phone?: unknown;
    customerType?: unknown;
    intent?: unknown;
    consent?: unknown;
    website?: unknown;
    tracking?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidFormat") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);

  // Dolt fält som bara botar fyller i. De får samma svar som en människa
  // men inget sparas, så de lär sig inget av att prova igen.
  if (typeof body.website === "string" && body.website.trim()) {
    log.info({ ip: getClientIp(c) }, "preview-gate: honeypot tripped");
    return c.json({ ok: true, alreadyRegistered: false, id: null });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 255) : null;

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return c.json({ error: uiError(locale, "enterValidEmail") }, 400);
  }

  // Intresseanmälan skickar mobil, kundtyp, avsikt och policy-ok. En
  // äldre klient som bara skickar e-post ska fortfarande kunna anmäla sig.
  const isInterest =
    body.phone !== undefined ||
    body.customerType !== undefined ||
    body.consent !== undefined;
  let phone: string | null = null;
  let customerType: InterestCustomerType | null = null;
  let intent: InterestIntent | null = null;
  if (isInterest) {
    phone = typeof body.phone === "string" ? normalizeInterestPhone(body.phone) : null;
    if (!phone) {
      return c.json({ error: uiError(locale, "enterValidPhone") }, 400);
    }
    customerType = INTEREST_CUSTOMER_TYPES.find((t) => t === body.customerType) ?? null;
    if (!customerType) {
      return c.json({ error: uiError(locale, "chooseCustomerType") }, 400);
    }
    intent = INTEREST_INTENTS.find((i) => i === body.intent) ?? "start";
    if (body.consent !== true) {
      return c.json({ error: uiError(locale, "acceptPrivacyPolicy") }, 400);
    }
  }
  const tracking = readTracking(body.tracking);
  const interest = isInterest
    ? {
        phone,
        customerType,
        intent,
        consentAt: new Date(),
        updatedAt: new Date(),
        ...(tracking ? { tracking } : {}),
      }
    : null;

  const ip = getClientIp(c);
  const rl = await checkRateLimit(`preview-waitlist:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }

  try {
    // Upsert pattern: re-submitting the same email is a no-op so the
    // user gets a "tack!" either way instead of a confusing duplicate
    // error. Touching `name` lets a returning visitor fill it in later.
    const existing = await db
      .select({ id: waitlistSignups.id })
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .limit(1);

    if (existing.length > 0) {
      if (name || interest) {
        await db
          .update(waitlistSignups)
          .set({ ...(name ? { name } : {}), ...(interest ?? {}) })
          .where(eq(waitlistSignups.id, existing[0]!.id));
      }
      return c.json({ ok: true, alreadyRegistered: true, id: existing[0]!.id });
    }

    const userAgent = c.req.header("user-agent")?.slice(0, 512) ?? null;
    const [row] = await db
      .insert(waitlistSignups)
      .values({
        email,
        name,
        source: interest ? "intresseanmalan" : "preview-gate",
        ipAddress: ip === "unknown" ? null : ip,
        userAgent,
        ...(interest ?? {}),
      })
      .returning({ id: waitlistSignups.id });

    log.info({ customerType, intent }, "preview-gate: waitlist signup");
    return c.json({ ok: true, alreadyRegistered: false, id: row?.id ?? null });
  } catch (err) {
    log.error({ err }, "preview-gate: waitlist insert failed");
    return c.json({ error: uiError(locale, "couldNotSave") }, 500);
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Steg 2 får bara komplettera en anmälan som nyss skickades. */
const COMPLETE_WINDOW_MS = 24 * 60 * 60 * 1000;

function cleanText(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * Steg 2: namn och förening/skola/klass. Sparas på anmälan och blir en
 * lead (crm_status LEAD, källa WEB) i säljpipelinen så att någon ringer.
 * En anmälan ger högst en lead; en ny komplettering byter bara namn på den
 * så länge den fortfarande är en orörd webblead.
 */
preview.post("/waitlist/complete", async (c) => {
  let body: {
    id?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    organisation?: unknown;
    locale?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidFormat") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null;
  if (!id) return c.json({ error: uiError(locale, "interestNotFound") }, 404);

  const firstName = cleanText(body.firstName, 120);
  const lastName = cleanText(body.lastName, 120);
  const organisation = cleanText(body.organisation, 255);
  if (!firstName || !lastName) {
    return c.json({ error: uiError(locale, "enterFullName") }, 400);
  }
  if (organisation.length < 2) {
    return c.json({ error: uiError(locale, "enterOrganisationName") }, 400);
  }

  const ip = getClientIp(c);
  const rl = await checkRateLimit(`preview-waitlist-complete:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }

  try {
    const [signup] = await db
      .select({
        id: waitlistSignups.id,
        updatedAt: waitlistSignups.updatedAt,
        createdAt: waitlistSignups.createdAt,
        organizationId: waitlistSignups.organizationId,
        customerType: waitlistSignups.customerType,
      })
      .from(waitlistSignups)
      .where(eq(waitlistSignups.id, id))
      .limit(1);
    const touchedAt = signup?.updatedAt ?? signup?.createdAt;
    if (!signup || !touchedAt || Date.now() - touchedAt.getTime() > COMPLETE_WINDOW_MS) {
      return c.json({ error: uiError(locale, "interestNotFound") }, 404);
    }

    let organizationId = signup.organizationId;
    if (organizationId) {
      await db
        .update(organizations)
        .set({ name: organisation, updatedAt: new Date() })
        .where(
          and(
            eq(organizations.id, organizationId),
            eq(organizations.crmStatus, "LEAD"),
            eq(organizations.leadSource, "WEB")
          )
        );
    } else {
      const [lead] = await db
        .insert(organizations)
        .values({
          name: organisation,
          type: signup.customerType === "lag" ? "team" : "club",
          crmStatus: "LEAD",
          leadSource: "WEB",
        })
        .returning({ id: organizations.id });
      organizationId = lead?.id ?? null;
    }

    await db
      .update(waitlistSignups)
      .set({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.slice(0, 255),
        organisation,
        organizationId,
        completedAt: new Date(),
      })
      .where(eq(waitlistSignups.id, id));

    if (organizationId) {
      void auditLog({
        userId: null,
        action: "interest.lead.created",
        entityType: "organization",
        entityId: organizationId,
        meta: { ...requestContext((n) => c.req.header(n)), customerType: signup.customerType },
      });
    }
    log.info({ organizationId }, "preview-gate: interest completed");
    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "preview-gate: interest complete failed");
    return c.json({ error: uiError(locale, "couldNotSave") }, 500);
  }
});
