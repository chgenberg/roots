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
import { eq } from "drizzle-orm";
import { db, waitlistSignups } from "@roots/db";
import { childLogger } from "../lib/logger";
import { checkRateLimit } from "../lib/rate-limit";
import {
  PREVIEW_COOKIE_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_NAME,
  getPreviewPassword,
  getPreviewToken,
  isPreviewGateDisabled,
} from "../lib/preview-gate";

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
    return c.json({ error: "Gaten är inaktiverad." }, 410);
  }

  let body: { password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltigt format" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return c.json({ error: "Ange lösenord." }, 400);
  }

  // Brute-force budget: 20 attempts per IP per hour. Generous enough
  // for a fat-fingered investor, tight enough that a script can't
  // exhaust a 6-character alphabet in any reasonable time.
  const ip = getClientIp(c);
  const rl = await checkRateLimit(`preview-unlock:${ip}`, 20, 3600);
  if (!rl.allowed) {
    return c.json({ error: "För många försök. Försök igen om en stund." }, 429);
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
    return c.json({ error: "Förhandsvisningen är felkonfigurerad." }, 503);
  }

  if (password !== expectedPassword) {
    log.info({ ip }, "preview-gate: failed unlock attempt");
    return c.json({ error: "Fel lösenord." }, 401);
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

preview.post("/waitlist", async (c) => {
  let body: { email?: unknown; name?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltigt format" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 255) : null;

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return c.json({ error: "Ange en giltig e-postadress." }, 400);
  }

  const ip = getClientIp(c);
  const rl = await checkRateLimit(`preview-waitlist:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return c.json({ error: "För många försök. Försök igen om en stund." }, 429);
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
      if (name) {
        await db
          .update(waitlistSignups)
          .set({ name })
          .where(eq(waitlistSignups.id, existing[0]!.id));
      }
      return c.json({ ok: true, alreadyRegistered: true });
    }

    const userAgent = c.req.header("user-agent")?.slice(0, 512) ?? null;
    await db.insert(waitlistSignups).values({
      email,
      name,
      source: "preview-gate",
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
    });

    log.info({ email }, "preview-gate: waitlist signup");
    return c.json({ ok: true, alreadyRegistered: false });
  } catch (err) {
    log.error({ err }, "preview-gate: waitlist insert failed");
    return c.json({ error: "Kunde inte spara just nu. Försök igen." }, 500);
  }
});
