import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { hash, verify } from "@node-rs/argon2";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  users,
  organizations,
  teams,
  sellers,
  campaigns,
} from "@roots/db/schema";
import {
  createSession,
  destroySession,
  destroyUserSessions,
  getSession,
  isDemoSession,
  refreshSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_REFRESH_THRESHOLD_MS,
} from "../lib/session";
import type { SessionData } from "../lib/session";
import { getEmailSender } from "../lib/email";
import {
  welcomeEmail,
  deletionRequestEmail,
  deletionCancelledEmail,
} from "../lib/email/templates";
import {
  issueDeletionCancelToken,
  verifyDeletionCancelToken,
} from "../lib/deletion-tokens";
import {
  loginRateLimit,
  registrationRateLimit,
  deletionCancelRateLimit,
  deleteAccountRateLimit,
} from "../lib/rate-limit";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { scheduleOrgNormalize } from "../lib/jobs/schedule-org-normalize";
import { shopSlug as makeShopSlug } from "../lib/slug";

const log = childLogger("auth");

export const auth = new Hono();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Off by default in production; set ROOTS_ENABLE_DEMO_ACCOUNTS=true for staging demos. */
const DEMO_ACCOUNTS_ENABLED =
  !IS_PRODUCTION || process.env.ROOTS_ENABLE_DEMO_ACCOUNTS === "true";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// P3.16 (audit 2026-05-26): registration endpoints accepted arbitrarily
// weak passwords. Strategy doc + change-password lean toward ≥12 chars.
// Returns null on success, error message otherwise.
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string") return "Lösenord saknas.";
  const trimmed = pw;
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`;
  }
  if (trimmed.length > MAX_PASSWORD_LENGTH) {
    return "Lösenordet är för långt (max 128 tecken).";
  }
  return null;
}

const DEMO_ACCOUNTS: Record<
  string,
  { password: string; role: string; name: string; orgName: string }
> = DEMO_ACCOUNTS_ENABLED
  ? {
      "klubb@demo.se": {
        password: "Demo1234!",
        role: "CLUB_ADMIN",
        name: "Anna Klubbsson",
        orgName: "Demo Fotbollsklubb",
      },
      "salj@roots.se": {
        password: "Demo1234!",
        role: "SALES_REP",
        name: "Erik Säljare",
        orgName: "Roots AB",
      },
      "admin@roots.se": {
        password: "Demo1234!",
        role: "INTERNAL_ADMIN",
        name: "Roots Admin",
        orgName: "Roots AB",
      },
      // Sprint E1: fundraising-portal roles. The in-memory fallback
      // gives a successful login experience, but the actual
      // /forening + /lag dashboards require DB-seeded data
      // (`pnpm db:seed:demo`) — otherwise the API returns 403
      // (`Ingen organisation`) because session.orgId is null on the
      // in-memory path.
      "forening@demo-if.se": {
        password: "Demo1234!",
        role: "ASSOCIATION_ADMIN",
        name: "Karin Lindgren",
        orgName: "Demo IF Sundsvall",
      },
      "lag@demo-if.se": {
        password: "Demo1234!",
        role: "TEAM_LEADER",
        name: "Mikael Berg",
        orgName: "Demo IF Sundsvall",
      },
    }
  : {};

auth.post("/login", async (c) => {
  let body: { email: string; password: string };
  try {
    body = await c.req.json<{ email: string; password: string }>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  if (!body.email || !body.password) {
    return c.json({ error: "E-post och lösenord krävs." }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const password = body.password.trim();
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rl = await loginRateLimit(ip, email);
  if (!rl.allowed) {
    return c.json(
      { error: "För många inloggningsförsök. Försök igen senare." },
      429
    );
  }

  // Prefer DB users (seed/registration) so sessions use real userId + orgId.
  // A DB-side failure (schema drift, connectivity hiccup, etc.) must NOT
  // block the in-memory demo fallback below — otherwise a missing prod
  // column locks every operator out of the staging-demo flow. We log the
  // error and fall through; if neither path matches we still return 401.
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      // P2.9 (audit 2026-05-26): blockera DB-login för raderade
      // tombstone-användare explicit. passwordHash-sentinelet räcker
      // som indirekt skydd idag, men ett ändrat hash-format eller
      // partiell purge skulle annars kunna släppa förbi en
      // återautentisering mot ett anonymiserat konto.
      if (user.deletedAt) {
        void auditLog({
          userId: user.id,
          action: "auth.login.failed",
          meta: { ...requestContext((n) => c.req.header(n)), reason: "deleted_account" },
        });
        return c.json({ error: "Felaktig e-post eller lösenord." }, 401);
      }

      const valid = await verify(user.passwordHash, password);
      if (!valid) {
        void auditLog({
          userId: user.id,
          action: "auth.login.failed",
          meta: { ...requestContext((n) => c.req.header(n)), reason: "bad_password" },
        });
        return c.json({ error: "Felaktig e-post eller lösenord." }, 401);
      }

      const sessionData: SessionData = {
        userId: user.id,
        role: user.role as SessionData["role"],
        orgId: user.orgId,
        createdAt: Date.now(),
      };

      let orgName: string | null = null;
      if (user.orgId) {
        try {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, user.orgId))
            .limit(1);
          orgName = org?.name ?? null;
        } catch (err) {
          // Org lookup is best-effort — a stale schema shouldn't kill
          // an otherwise-valid login. We just present an empty orgName.
          log.warn({ err, userId: user.id }, "org lookup failed during login");
        }
      }

      // Connection-audit P0 #4: a Redis hiccup must not surface as a 500
      // on real accounts (the demo branch already returned 503; align them).
      let sessionId: string;
      try {
        sessionId = await createSession(sessionData);
      } catch (err) {
        log.error({ err, userId: user.id }, "createSession failed during DB login");
        return c.json({ error: "Sessionshantering otillgänglig." }, 503);
      }
      setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

      void auditLog({
        userId: user.id,
        action: "auth.login.success",
        meta: { ...requestContext((n) => c.req.header(n)), role: user.role },
      });

      return c.json({
        ok: true,
        user: {
          email: user.email,
          role: user.role,
          name: user.contactName || email,
          orgName: orgName || "",
        },
      });
    }
  } catch (err) {
    // Log loudly so schema drift is visible in production, but DON'T
    // return 401 here — that swallowed the demo fallback in prod when
    // migration 0001 hadn't been applied. Fall through instead.
    log.warn({ err, email: email.slice(0, 120) }, "DB user lookup failed during login — falling back to demo accounts");
  }

  void auditLog({
    action: "auth.login.failed",
    meta: { ...requestContext((n) => c.req.header(n)), reason: "no_user", email: email.slice(0, 120) },
  });

  // Fallback: in-memory demo (local dev, or ROOTS_ENABLE_DEMO_ACCOUNTS on Railway)
  const demo = DEMO_ACCOUNTS[email];
  if (demo && demo.password === password) {
    const sessionData: SessionData = {
      userId: crypto.randomUUID(),
      role: demo.role as SessionData["role"],
      orgId: null,
      createdAt: Date.now(),
      demoProfile: { email, name: demo.name, orgName: demo.orgName },
    };

    try {
      const sessionId = await createSession(sessionData);
      setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    } catch {
      return c.json({ error: "Sessionshantering otillgänglig." }, 503);
    }

    return c.json({
      ok: true,
      user: { email, role: demo.role, name: demo.name, orgName: demo.orgName },
    });
  }

  return c.json({ error: "Felaktig e-post eller lösenord." }, 401);
});

auth.post("/logout", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  if (match) {
    let userId: string | null = null;
    try {
      const session = await getSession(match[1]);
      userId = session?.userId ?? null;
    } catch {}
    try {
      await destroySession(match[1]);
    } catch {}
    void auditLog({
      userId,
      action: "auth.logout",
      meta: { ...requestContext((n) => c.req.header(n)) },
    });
  }

  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

// ── Change password (Sprint C — "Knapparna fungerar") ───────────────
//
// `POST /v1/auth/change-password` powers the "Byt lösenord"-knappen i
// /portal/installningar. Requirements:
//   - must be authenticated (DB-session, not demo-only)
//   - verify the current password against `users.passwordHash`
//   - enforce minimum complexity on the new password
//   - re-hash with the same argon2 parameters used at register/seed time
//   - invalidate other sessions? — out of scope for the MVP, noted as
//     a follow-up. The current session keeps working so the user
//     doesn't get bounced back to the login screen.
auth.post("/change-password", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return c.json({ error: "Ej inloggad" }, 401);

  const currentSessionId = match[1];
  let session: SessionData | null = null;
  try {
    session = await getSession(currentSessionId);
  } catch {
    return c.json({ error: "Ej inloggad" }, 401);
  }
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // Demo sessions don't have a DB row — their password lives in code,
  // so we can't rotate it. Reject explicitly so the UI can show a
  // friendly message instead of a generic 500.
  // Pre-push fix 2026-05-26: använd isDemoSession() så vi även
  // täcker DB-seedade demo-konton (P3.28), inte bara in-memory.
  if (!session.userId || isDemoSession(session)) {
    return c.json(
      { error: "Demo-konton kan inte byta lösenord. Skapa ett riktigt konto." },
      400
    );
  }

  type Body = { currentPassword?: string; newPassword?: string };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const current = (body.currentPassword ?? "").trim();
  const next = (body.newPassword ?? "").trim();

  if (!current || !next) {
    return c.json({ error: "Båda fälten krävs." }, 400);
  }
  const pwErr = validatePassword(next);
  if (pwErr) return c.json({ error: pwErr }, 400);
  if (next === current) {
    return c.json(
      { error: "Nytt lösenord får inte vara samma som det gamla." },
      400
    );
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return c.json({ error: "Ej inloggad" }, 401);

    // verify() throws if the stored hash isn't a valid argon2 string.
    // Invited members have a `invite-pending-…`-prefixed sentinel that
    // is not a valid hash; treat that as "no current password" and
    // refuse politely instead of 500.
    let valid: boolean;
    try {
      valid = await verify(user.passwordHash, current);
    } catch {
      return c.json(
        { error: "Lösenordet kan inte verifieras för det här kontot." },
        400
      );
    }
    if (!valid) {
      void auditLog({
        userId: user.id,
        action: "auth.change_password.failed",
        meta: { ...requestContext((n) => c.req.header(n)), reason: "bad_current" },
      });
      return c.json({ error: "Fel nuvarande lösenord." }, 401);
    }

    const newHash = await hash(next, ARGON2_OPTIONS);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // MASTERPLAN_01 KC2.6: a password rotation must kick every other
    // device. Best-effort — a Redis hiccup here MUST NOT fail the
    // rotation since the hash has already been updated.
    let revokedCount = 0;
    try {
      revokedCount = await destroyUserSessions(user.id, currentSessionId);
    } catch (err) {
      log.warn({ err, userId: user.id }, "failed to revoke other sessions after password change");
    }

    void auditLog({
      userId: user.id,
      action: "auth.change_password.ok",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        revokedOtherSessions: revokedCount,
      },
    });

    return c.json({ ok: true, revokedOtherSessions: revokedCount });
  } catch (err) {
    log.error({ err, userId: session.userId }, "change-password failed");
    return c.json({ error: "Kunde inte byta lösenord just nu." }, 500);
  }
});

// ── KC2.7 — GDPR account-deletion ──────────────────────────────────
//
// 3-stegs flow:
//   POST /v1/auth/delete-account        — begär radering (password+confirm)
//   GET  /v1/auth/deletion-status       — current status (for portal UI)
//   POST /v1/auth/cancel-deletion       — ångra (inloggad ELLER token)
//
// Själva PII-anonymiseringen sker i en separat scheduled worker som
// poll:ar `scheduled_deletion_at <= now()` (se workers/deletion-purge.ts).
// På så sätt är request-endpoints helt stateless / non-blocking, och en
// crash i purge:n stoppar bara den användaren — inte begäran-flödet.

const DELETION_COOLDOWN_DAYS = 14;
const DELETION_COOLDOWN_MS = DELETION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

auth.post("/delete-account", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return c.json({ error: "Ej inloggad" }, 401);

  const currentSessionId = match[1];
  let session: SessionData | null = null;
  try {
    session = await getSession(currentSessionId);
  } catch {
    return c.json({ error: "Ej inloggad" }, 401);
  }
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // Demo-sessions har ingen DB-rad; ingen att radera.
  // Pre-push fix 2026-05-26: täck även DB-seedade demo-konton (P3.28).
  if (!session.userId || isDemoSession(session)) {
    return c.json(
      { error: "Demo-konton kan inte raderas — de saknar persistent data." },
      400
    );
  }

  // P3.59 (audit 2026-05-26): tidigare hade /delete-account ingen
  // throttle utöver session-auth. En stulen session kunde brute-force:a
  // användarens lösenord (svart-back-up för logout-konfirmation).
  // 5 försök per 15 min per user räcker för "fingrarna i munnen"-fel.
  const rl = await deleteAccountRateLimit(session.userId);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många försök. Försök igen om en stund." },
      429
    );
  }

  type Body = { password?: string; confirm?: string };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const password = (body.password ?? "").trim();
  // Klient skickar "RADERA" som extra friction-step — minskar risken
  // för 1-click-deletion när användaren testar UI:t.
  const confirm = (body.confirm ?? "").trim();

  if (!password) return c.json({ error: "Lösenord krävs." }, 400);
  if (confirm !== "RADERA") {
    return c.json(
      { error: 'Bekräftelse-fältet måste innehålla ordet "RADERA".' },
      400
    );
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return c.json({ error: "Ej inloggad" }, 401);

    // Redan begärt: returnera idempotent OK med scheduledAt. Användaren
    // ska inte få ett 409 som ser ut som en bugg.
    if (user.deletionRequestedAt && user.scheduledDeletionAt) {
      return c.json({
        ok: true,
        alreadyRequested: true,
        scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
      });
    }

    // Redan raderat: 410 Gone.
    if (user.deletedAt) {
      return c.json({ error: "Kontot är redan raderat." }, 410);
    }

    let valid: boolean;
    try {
      valid = await verify(user.passwordHash, password);
    } catch {
      return c.json(
        { error: "Lösenordet kan inte verifieras för det här kontot." },
        400
      );
    }
    if (!valid) {
      void auditLog({
        userId: user.id,
        action: "auth.delete_account.failed",
        meta: {
          ...requestContext((n) => c.req.header(n)),
          reason: "bad_password",
        },
      });
      return c.json({ error: "Fel lösenord." }, 401);
    }

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + DELETION_COOLDOWN_MS);

    await db
      .update(users)
      .set({
        deletionRequestedAt: now,
        scheduledDeletionAt: scheduledAt,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // Logga ut alla sessions (även current) så att kontot inte längre
    // kan användas under cooldown. Användaren kan dock fortfarande
    // logga in igen och då ses banner: "ditt konto är schemalagt
    // för radering om X dagar".
    try {
      await destroyUserSessions(user.id);
    } catch (err) {
      log.warn({ err, userId: user.id }, "failed to revoke sessions after deletion request");
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });

    void auditLog({
      userId: user.id,
      action: "auth.delete_account.requested",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        scheduledAt: scheduledAt.toISOString(),
        cooldownDays: DELETION_COOLDOWN_DAYS,
      },
    });

    // Fire-and-forget bekräftelse-mail. Innehåller signed cancel-token
    // så användaren kan ångra utan att behöva logga in.
    void (async () => {
      try {
        const token = issueDeletionCancelToken(user.id);
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.SITE_URL ||
          "https://roots.se";
        const cancelUrl = `${siteUrl}/konto/avbryt-radering?token=${encodeURIComponent(token)}`;
        await getEmailSender().sendEmail({
          to: user.email,
          ...deletionRequestEmail({
            name:
              user.contactName?.split(" ")[0] ||
              user.email.split("@")[0] ||
              "där",
            scheduledDeletionAt: scheduledAt,
            cancelUrl,
          }),
        });
      } catch (err) {
        log.error({ err, userId: user.id }, "deletion request email failed");
      }
    })();

    return c.json({
      ok: true,
      scheduledDeletionAt: scheduledAt.toISOString(),
      cooldownDays: DELETION_COOLDOWN_DAYS,
    });
  } catch (err) {
    log.error({ err, userId: session.userId }, "delete-account failed");
    return c.json({ error: "Kunde inte registrera begäran just nu." }, 500);
  }
});

auth.get("/deletion-status", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return c.json({ status: "none" });

  try {
    const session = await getSession(match[1]);
    if (!session?.userId) return c.json({ status: "none" });

    const [user] = await db
      .select({
        deletionRequestedAt: users.deletionRequestedAt,
        scheduledDeletionAt: users.scheduledDeletionAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) return c.json({ status: "none" });
    if (user.deletedAt) return c.json({ status: "deleted" });
    if (user.scheduledDeletionAt) {
      return c.json({
        status: "scheduled",
        requestedAt: user.deletionRequestedAt?.toISOString() ?? null,
        scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
      });
    }
    return c.json({ status: "none" });
  } catch (err) {
    log.warn({ err }, "deletion-status failed");
    return c.json({ status: "unknown" });
  }
});

/**
 * Avbryt en pågående radering. Två paths:
 *   1. Inloggad ASSOCIATION_ADMIN/SELLER/… med samma userId.
 *   2. Anonym med valid signed `?token=` (från mailen). Detta gör att
 *      en användare som har tappat lösenordet ändå kan ångra (kritiskt
 *      när användaren råkar trigga delete från fel knapp och sedan
 *      blir utloggad).
 *
 * Bägge fall: nollar deletionRequestedAt + scheduledDeletionAt + skickar
 * bekräftelse-mail.
 */
auth.post("/cancel-deletion", async (c) => {
  // P2.41 (audit 2026-05-26): rate-limit:a endpointen så att en
  // angripare som fångat en deletion-cancel-länk inte kan göra
  // bulk-anrop med olika tokens för att brute-force HMAC eller
  // probeera vilka konton som är i raderingskö.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await deletionCancelRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många försök. Vänta några minuter och försök igen." },
      429
    );
  }

  type Body = { token?: string };
  let body: Body = {};
  try {
    body = await c.req.json<Body>();
  } catch {
    // OK — tom body är giltigt när man försöker via session.
  }

  let targetUserId: string | null = null;
  let viaToken = false;

  if (body.token) {
    const verified = verifyDeletionCancelToken(body.token);
    if (!verified) {
      return c.json({ error: "Ogiltig eller utgången länk." }, 400);
    }
    targetUserId = verified.userId;
    viaToken = true;
  } else {
    const cookie = c.req.header("cookie") || "";
    const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match) return c.json({ error: "Ej inloggad." }, 401);
    try {
      const session = await getSession(match[1]);
      if (!session?.userId) return c.json({ error: "Ej inloggad." }, 401);
      targetUserId = session.userId;
    } catch {
      return c.json({ error: "Ej inloggad." }, 401);
    }
  }

  if (!targetUserId) return c.json({ error: "Ej inloggad." }, 401);

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!user) return c.json({ error: "Användare hittades inte." }, 404);
    if (user.deletedAt) {
      return c.json({ error: "Kontot är redan raderat och kan inte återställas." }, 410);
    }
    if (!user.scheduledDeletionAt) {
      // Idempotent: redan ångrat / aldrig begärt.
      return c.json({ ok: true, alreadyCancelled: true });
    }

    await db
      .update(users)
      .set({
        deletionRequestedAt: null,
        scheduledDeletionAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    void auditLog({
      userId: user.id,
      action: "auth.delete_account.cancelled",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        viaToken,
      },
    });

    void (async () => {
      try {
        await getEmailSender().sendEmail({
          to: user.email,
          ...deletionCancelledEmail({
            name:
              user.contactName?.split(" ")[0] ||
              user.email.split("@")[0] ||
              "där",
          }),
        });
      } catch (err) {
        log.error({ err, userId: user.id }, "cancellation email failed");
      }
    })();

    return c.json({ ok: true });
  } catch (err) {
    log.error({ err, userId: targetUserId }, "cancel-deletion failed");
    return c.json({ error: "Kunde inte avbryta raderingen just nu." }, 500);
  }
});

auth.get("/me", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  if (!match) {
    return c.json({ user: null }, 200);
  }

  const sessionId = match[1];

  // Try Redis session first
  try {
    const session = await getSession(sessionId);
    if (session) {
      // MASTERPLAN_01 KC2.4: rolling-window-refresh. När sessionen har
      // använts mer än halva sin TTL, förläng både Redis-TTL och
      // browser-cookie:n så att aktiva användare inte loggas ut
      // mitt i ett köp efter 7 dagar. Best-effort: en Redis-hick får
      // inte blockera /me-svaret.
      const ageMs = Date.now() - (session.createdAt ?? 0);
      if (ageMs > SESSION_REFRESH_THRESHOLD_MS) {
        try {
          await refreshSession(sessionId);
          setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
        } catch (err) {
          log.warn({ err }, "session refresh failed (non-fatal)");
        }
      }

      let email = "";
      let name = "";
      let orgName = "";

      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (user) {
          email = user.email;
          name = user.contactName || user.email;

          if (user.orgId) {
            const [org] = await db
              .select()
              .from(organizations)
              .where(eq(organizations.id, user.orgId))
              .limit(1);
            orgName = org?.name ?? "";
          }
        } else if (session.demoProfile) {
          email = session.demoProfile.email;
          name = session.demoProfile.name;
          orgName = session.demoProfile.orgName;
        }
      } catch {}

      return c.json({
        user: {
          email,
          role: session.role,
          name,
          orgName,
          orgId: session.orgId,
          userId: session.userId,
        },
      });
    }
  } catch {}

  return c.json({ user: null }, 200);
});

auth.post("/register/association", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP innan vi rör DB
  // eller skickar welcome-email. Förhindrar trivial signup-flood.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många registreringar från denna IP. Försök igen senare." },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const {
    orgName,
    orgNumber,
    nationalFederation,
    sportType,
    email,
    password,
    contactName,
    phone,
    personalNumber,
    addressLine1,
    city,
    postalCode,
  } = body;

  if (!orgName || !email || !password || !contactName) {
    return c.json({ error: "Alla obligatoriska fält måste fyllas i." }, 400);
  }

  const pwErr = validatePassword(password);
  if (pwErr) return c.json({ error: pwErr }, 400);

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: "E-postadressen är redan registrerad." }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    const { org, user } = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          orgNumber: orgNumber || null,
          type: "association",
          nationalFederation: nationalFederation || null,
          sportType: sportType || null,
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "ASSOCIATION_ADMIN",
          orgId: org.id,
          contactName,
          phone: phone || null,
          personalNumber: personalNumber || null,
          addressLine1: addressLine1 || null,
          city: city || null,
          postalCode: postalCode || null,
        })
        .returning();

      return { org, user };
    });

    // Enqueue AFTER tx commits — pg-boss runs on a separate connection and
    // cannot participate in the Drizzle transaction. If we enqueued inside
    // the tx and it rolled back, we'd schedule work for a non-existent org.
    scheduleOrgNormalize(org.id);

    const sessionData: SessionData = {
      userId: user.id,
      role: "ASSOCIATION_ADMIN",
      orgId: org.id,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: user.id,
      action: "auth.register.association",
      entityType: "organization",
      entityId: org.id,
      meta: { ...requestContext((n) => c.req.header(n)) },
    });

    getEmailSender()
      .sendEmail({
        to: user.email,
        ...welcomeEmail(contactName, "ASSOCIATION_ADMIN"),
      })
      .catch((e) => log.error({ err: e }, "Registration email failed"));

    return c.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.contactName,
        orgName: org.name,
        orgId: org.id,
        userId: user.id,
      },
    });
  } catch (err) {
    log.error({ err }, "Association registration failed");
    return c.json({ error: "Registreringen misslyckades." }, 500);
  }
});

auth.post("/register/team-leader", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många registreringar från denna IP. Försök igen senare." },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const {
    teamName,
    orgName,
    existingOrgId,
    email,
    password,
    contactName,
    phone,
    personalNumber,
    addressLine1,
    city,
    postalCode,
  } = body;

  if (!teamName || !email || !password || !contactName) {
    return c.json({ error: "Alla obligatoriska fält måste fyllas i." }, 400);
  }

  const pwErr = validatePassword(password);
  if (pwErr) return c.json({ error: pwErr }, 400);

  // P2.5 (audit 2026-05-26): tidigare lät endpointen vem som helst
  // ansluta sin nya team-leader till en valfri existerande
  // organisations-UUID utan att äga den. Det betydde att en angripare
  // kunde gissa/läcka org-IDt och sätta sig själv som TEAM_LEADER
  // i en annan förening. Den enda legitima vägen in i en befintlig
  // förening är via team-invite (`/v1/association/team-invites/claim`).
  // Vi avvisar därför `existingOrgId` här explicit; klienten ska
  // använda invite-flödet i stället.
  if (existingOrgId !== undefined && existingOrgId !== null && existingOrgId !== "") {
    return c.json(
      {
        error:
          "För att gå med i en befintlig förening, använd ett team-invite från föreningens admin.",
      },
      400
    );
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: "E-postadressen är redan registrerad." }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    let validatedOrgId: string | null = null;
    let resolvedOrgName = orgName || teamName;

    // Captured inside the tx and consumed AFTER commit. Must be `let` (and
    // declared outside the closure) so the enqueue call below the tx can see
    // whether a new org was actually created.
    let newlyCreatedOrgId: string | null = null;

    const txResult = await db.transaction(async (tx) => {
      let orgId: string | null = validatedOrgId;

      if (!orgId && orgName) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: orgName, type: "club" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
        newlyCreatedOrgId = org.id;
      } else if (!orgId) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: teamName, type: "team" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
        newlyCreatedOrgId = org.id;
      }

      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "TEAM_LEADER",
          orgId,
          contactName,
          phone: phone || null,
          personalNumber: personalNumber || null,
          addressLine1: addressLine1 || null,
          city: city || null,
          postalCode: postalCode || null,
        })
        .returning();

      let createdTeamId: string | null = null;

      const [activeCampaign] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.orgId, orgId!), eq(campaigns.status, "ACTIVE")))
        .orderBy(campaigns.createdAt)
        .limit(1);

      if (activeCampaign) {
        const inviteToken = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
        const [team] = await tx
          .insert(teams)
          .values({
            orgId: orgId!,
            campaignId: activeCampaign.id,
            leaderId: user.id,
            name: teamName,
            inviteToken,
          })
          .returning();
        createdTeamId = team.id;
      }

      return { orgId: orgId!, user, createdTeamId };
    });

    // Enqueue AFTER tx commits — see note in /register/association above.
    if (newlyCreatedOrgId) {
      scheduleOrgNormalize(newlyCreatedOrgId);
    }

    const sessionData: SessionData = {
      userId: txResult.user.id,
      role: "TEAM_LEADER",
      orgId: txResult.orgId,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: txResult.user.id,
      action: "auth.register.team_leader",
      entityType: "team",
      entityId: txResult.createdTeamId,
      meta: { ...requestContext((n) => c.req.header(n)), orgId: txResult.orgId },
    });

    getEmailSender()
      .sendEmail({
        to: txResult.user.email,
        ...welcomeEmail(contactName, "TEAM_LEADER"),
      })
      .catch((e) => log.error({ err: e }, "Team leader registration email failed"));

    return c.json({
      ok: true,
      user: {
        email: txResult.user.email,
        role: txResult.user.role,
        name: txResult.user.contactName,
        orgName: resolvedOrgName,
        orgId: txResult.orgId,
        userId: txResult.user.id,
      },
      teamName,
      teamId: txResult.createdTeamId,
    });
  } catch (err) {
    log.error({ err }, "Team leader registration failed");
    return c.json({ error: "Registreringen misslyckades." }, 500);
  }
});

auth.post("/register/seller", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP. Seller-flow är extra
  // intressant att skydda — invite-token gatekeepar typen men token kan
  // gå viralt och vi vill inte att en miljö som läcker den blir DOSad.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många registreringar från denna IP. Försök igen senare." },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const { inviteToken, email, password, displayName, phone } = body;

  if (!inviteToken || !email || !password || !displayName) {
    return c.json({ error: "Alla obligatoriska fält måste fyllas i." }, 400);
  }

  const pwErr = validatePassword(password);
  if (pwErr) return c.json({ error: pwErr }, 400);

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.inviteToken, inviteToken))
      .limit(1);

    if (!team) {
      return c.json({ error: "Ogiltig inbjudningslänk." }, 404);
    }

    // MASTERPLAN_01 KC3.4: token-rotation. Existerande rader har
    // inviteTokenExpiresAt = null + inviteTokenMaxUses = null vilket
    // är "backward-compatible" (samma evig+multi-use som tidigare).
    // Roterade tokens har konkreta värden — då måste vi validera.
    if (
      team.inviteTokenExpiresAt &&
      team.inviteTokenExpiresAt.getTime() < Date.now()
    ) {
      return c.json(
        { error: "Inbjudningslänken har gått ut. Be lagledaren skapa en ny." },
        410
      );
    }
    if (
      team.inviteTokenMaxUses !== null &&
      team.inviteTokenUseCount >= team.inviteTokenMaxUses
    ) {
      return c.json(
        { error: "Inbjudningslänken är förbrukad. Be lagledaren skapa en ny." },
        410
      );
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: "E-postadressen är redan registrerad." }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    // MASTERPLAN_01 KC3.5: swedish-aware slug. The previous regex stripped
    // every å/ä/ö which left e.g. "Åsa Söderström" with the slug "------".
    const shopSlug = makeShopSlug(displayName);

    // P2.20 (audit 2026-05-26): tidigare gjordes max_uses-checken med
    // ett läs-värde innan UPDATE — två concurrent requests på samma
    // token kunde båda passera checken och båda bump:a +1 så att
    // useCount > maxUses. Vi gör nu en konditional UPDATE som första
    // steg i transaktionen och rollbackar hela inserten om ingen rad
    // ändrades. Atomiska sql`+1` skyddar mot dubbelräkning av single
    // counter men inte mot att passera maxUses-gränsen.
    type RegistrationResult =
      | { ok: true; user: typeof users.$inferSelect }
      | { ok: false; reason: "invite_exhausted" };
    let result: RegistrationResult;
    try {
      result = await db.transaction<RegistrationResult>(async (tx) => {
        const updated = await tx
          .update(teams)
          .set({
            memberCount: sql`${teams.memberCount} + 1`,
            inviteTokenUseCount: sql`${teams.inviteTokenUseCount} + 1`,
          })
          .where(
            and(
              eq(teams.id, team.id),
              sql`(${teams.inviteTokenMaxUses} IS NULL OR ${teams.inviteTokenUseCount} < ${teams.inviteTokenMaxUses})`
            )
          )
          .returning({ id: teams.id });

        if (updated.length === 0) {
          throw new Error("InviteExhausted");
        }

        const [createdUser] = await tx
          .insert(users)
          .values({
            email: email.toLowerCase().trim(),
            passwordHash,
            role: "SELLER",
            orgId: team.orgId,
            contactName: displayName,
            phone: phone || null,
          })
          .returning();

        await tx.insert(sellers).values({
          userId: createdUser.id,
          teamId: team.id,
          campaignId: team.campaignId,
          shopSlug,
          displayName,
        });

        return { ok: true, user: createdUser };
      });
    } catch (err) {
      if ((err as Error)?.message === "InviteExhausted") {
        result = { ok: false, reason: "invite_exhausted" };
      } else {
        throw err;
      }
    }

    if (!result.ok) {
      return c.json(
        { error: "Inbjudningslänken är förbrukad. Be lagledaren skapa en ny." },
        410
      );
    }
    const user = result.user;

    const sessionData: SessionData = {
      userId: user.id,
      role: "SELLER",
      orgId: team.orgId,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: user.id,
      action: "auth.register.seller",
      entityType: "user",
      entityId: user.id,
      meta: { ...requestContext((n) => c.req.header(n)), teamId: team.id, shopSlug },
    });

    getEmailSender()
      .sendEmail({
        to: user.email,
        ...welcomeEmail(displayName, "SELLER"),
      })
      .catch((e) => log.error({ err: e }, "Seller registration email failed"));

    return c.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.contactName,
        userId: user.id,
      },
      shopSlug,
    });
  } catch (err) {
    log.error({ err }, "Seller registration failed");
    return c.json({ error: "Registreringen misslyckades." }, 500);
  }
});

auth.get("/organizations/search", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionId = match ? match[1] : null;
  if (!sessionId) return c.json({ error: "Ej inloggad" }, 401);

  let session: SessionData | null = null;
  try {
    session = await getSession(sessionId);
  } catch {}
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // P2.6 (audit 2026-05-26): tidigare exponerade endpointen ett
  // cross-tenant-directory över alla organisationer för vilken
  // inloggad användare som helst (inkl SELLER/CLUB_MEMBER). Begränsa
  // till roller som faktiskt behöver söka — SALES_REP/SALES_ADMIN/
  // INTERNAL_ADMIN — och TEAM_LEADER (som kan vara på väg att
  // registrera ny förening eller verifiera namnkonflikt). Övriga
  // får 403.
  const ALLOWED_ROLES = new Set([
    "SALES_REP",
    "SALES_ADMIN",
    "INTERNAL_ADMIN",
    "TEAM_LEADER",
  ]);
  if (!ALLOWED_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const query = c.req.query("q") || "";
  if (query.length < 2) {
    return c.json({ organizations: [] });
  }

  const sanitized = query.replace(/[%_]/g, "");
  if (sanitized.length < 2) {
    return c.json({ organizations: [] });
  }

  try {
    const results = await db
      .select({ id: organizations.id, name: organizations.name, type: organizations.type })
      .from(organizations)
      .where(ilike(organizations.name, `%${sanitized}%`))
      .limit(10);

    return c.json({ organizations: results });
  } catch {
    return c.json({ organizations: [] });
  }
});
