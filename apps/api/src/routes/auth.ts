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
  refreshSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_REFRESH_THRESHOLD_MS,
} from "../lib/session";
import type { SessionData } from "../lib/session";
import { getEmailSender } from "../lib/email";
import { welcomeEmail } from "../lib/email/templates";
import { loginRateLimit, registrationRateLimit } from "../lib/rate-limit";
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
  if (!session.userId || session.demoProfile) {
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
  if (next.length < 8) {
    return c.json(
      { error: "Nytt lösenord måste vara minst 8 tecken." },
      400
    );
  }
  if (next.length > 128) {
    return c.json({ error: "Nytt lösenord är för långt." }, 400);
  }
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
  } catch (err: any) {
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

    let validatedOrgId = existingOrgId;
    let resolvedOrgName = orgName || teamName;

    if (validatedOrgId) {
      if (typeof validatedOrgId !== "string" || !/^[0-9a-f-]{36}$/i.test(validatedOrgId)) {
        return c.json({ error: "Ogiltigt organisations-ID." }, 400);
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, validatedOrgId))
        .limit(1);

      if (!org) {
        return c.json({ error: "Föreningen kunde inte hittas." }, 404);
      }

      resolvedOrgName = org.name;
    }

    // Captured inside the tx and consumed AFTER commit. Must be `let` (and
    // declared outside the closure) so the enqueue call below the tx can see
    // whether a new org was actually created.
    let newlyCreatedOrgId: string | null = null;

    const txResult = await db.transaction(async (tx) => {
      let orgId = validatedOrgId;

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
  } catch (err: any) {
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

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.inviteToken, inviteToken))
      .limit(1);

    if (!team) {
      return c.json({ error: "Ogiltig inbjudningslänk." }, 404);
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

    const user = await db.transaction(async (tx) => {
      const [user] = await tx
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
        userId: user.id,
        teamId: team.id,
        campaignId: team.campaignId,
        shopSlug,
        displayName,
      });

      await tx
        .update(teams)
        .set({ memberCount: sql`${teams.memberCount} + 1` })
        .where(eq(teams.id, team.id));

      return user;
    });

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
  } catch (err: any) {
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
