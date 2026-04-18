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
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../lib/session";
import type { SessionData } from "../lib/session";
import { getEmailSender } from "../lib/email";
import { welcomeEmail } from "../lib/email/templates";
import { loginRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";

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
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, user.orgId))
          .limit(1);
        orgName = org?.name ?? null;
      }

      const sessionId = await createSession(sessionData);
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
  } catch {
    return c.json({ error: "Felaktig e-post eller lösenord." }, 401);
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

    const txResult = await db.transaction(async (tx) => {
      let orgId = validatedOrgId;

      if (!orgId && orgName) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: orgName, type: "club" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
      } else if (!orgId) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: teamName, type: "team" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
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

    const shopSlug =
      displayName.toLowerCase().replace(/[^a-z0-9]/g, "-") +
      "-" +
      crypto.randomUUID().slice(0, 6);

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
