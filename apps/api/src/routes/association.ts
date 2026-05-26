/**
 * Association-portal endpoints — Sprint E9.
 *
 * Surfaces three new actions for ASSOCIATION_ADMIN users that were
 * documented as P0 gaps in `docs/ROLE_GAP_AUDIT.md`:
 *
 *   POST /v1/association/team-invites      — create a pre-team invite
 *   GET  /v1/association/team-invites/:t   — public preview of an invite
 *   POST /v1/association/team-invites/claim — public, claim + create team
 *   POST /v1/association/campaigns         — start a new fundraising campaign
 *
 * The team-invite flow exists because `teams.leader_id` is NOT NULL, so
 * we can't write a row before the coach has accepted. We hold the
 * "team-to-be" metadata in `team_invites` until then.
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { db } from "@roots/db";
import {
  organizations,
  campaigns,
  teams,
  teamInvites,
  users,
} from "@roots/db/schema";
import {
  getSession,
  SESSION_COOKIE_NAME,
  createSession,
} from "../lib/session";
import type { SessionData } from "../lib/session";
import { auditLog, requestContext } from "../lib/audit";
import { childLogger } from "../lib/logger";
import { setCookie } from "hono/cookie";
import { getEmailSender } from "../lib/email";
import {
  teamLeaderInviteEmail,
  teamLeaderClaimedEmail,
} from "../lib/email/templates";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://roots.se"
).replace(/\/$/, "");

const log = childLogger("association");

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export const association = new Hono();

// ── helpers ──────────────────────────────────────────────────────
function getSessionId(c: any): string | null {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

async function requireSession(c: any): Promise<SessionData | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;
  try {
    return await getSession(sessionId);
  } catch {
    return null;
  }
}

function generateToken(): string {
  // 32 chars of url-safe hex — collision-resistant + short enough for QR.
  return randomBytes(16).toString("hex");
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "kampanj"
  );
}

async function ensureUniqueSlug(base: string): Promise<string> {
  // We append a 4-char suffix until we find a free slug. Campaigns
  // are rare enough that this loop converges quickly.
  let candidate = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const [hit] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  // Extremely unlikely; surface as a 500 rather than spin forever.
  throw new Error("Could not generate a unique campaign slug.");
}

// ── POST /team-invites ───────────────────────────────────────────
/**
 * Create a pre-team invite. Requires ASSOCIATION_ADMIN whose orgId
 * matches the inviting org. Body must include the target campaignId
 * (must belong to the same org) and the desired team name. An optional
 * `invitedEmail` lets the UI suggest who the invite is meant for —
 * we don't actually email it from here (the operator copies the URL).
 */
association.post("/team-invites", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!session.orgId) return c.json({ error: "Ingen organisation" }, 403);
  if (session.role !== "ASSOCIATION_ADMIN" && session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  type Body = {
    campaignId?: string;
    teamName?: string;
    invitedEmail?: string;
  };

  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const campaignId = (body.campaignId ?? "").trim();
  const teamName = (body.teamName ?? "").trim();
  const invitedEmail = body.invitedEmail?.trim().toLowerCase() || null;

  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
    return c.json({ error: "Ogiltigt kampanj-ID." }, 400);
  }
  if (!teamName || teamName.length < 2 || teamName.length > 255) {
    return c.json({ error: "Lagnamn måste vara 2–255 tecken." }, 400);
  }
  if (invitedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
    return c.json({ error: "Ogiltig e-postadress." }, 400);
  }

  try {
    // Validate campaign belongs to the inviting org.
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return c.json({ error: "Kampanjen hittades inte." }, 404);
    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(teamInvites)
      .values({
        orgId: campaign.orgId,
        campaignId: campaign.id,
        teamName,
        invitedEmail,
        token,
        createdByUserId: session.userId ?? null,
        expiresAt,
      })
      .returning();

    void auditLog({
      userId: session.userId,
      action: "association.team_invite.created",
      entityType: "team_invite",
      entityId: invite.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: campaign.orgId,
        campaignId: campaign.id,
        emailQueued: Boolean(invitedEmail),
      },
    });

    // MASTERPLAN_01 KC3.3: skicka invite-email om admin angett en
    // adress. Fire-and-forget: ett mailfel ska INTE blocka invite-
    // creation (admin har fortfarande en URL att copy-pasta).
    let emailSent = false;
    if (invitedEmail) {
      try {
        const [org] = await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, campaign.orgId))
          .limit(1);

        const [inviter] = session.userId
          ? await db
              .select({ contactName: users.contactName, email: users.email })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1)
          : [];

        const inviterName =
          inviter?.contactName ||
          inviter?.email?.split("@")[0] ||
          "Föreningsadmin";

        const inviteUrl = `${SITE_URL}/registrera/lagansvarig/${invite.token}`;

        void getEmailSender()
          .sendEmail({
            to: invitedEmail,
            ...teamLeaderInviteEmail({
              inviterName,
              orgName: org?.name ?? "föreningen",
              campaignName: campaign.name,
              teamName: invite.teamName,
              inviteUrl,
              expiresAt: invite.expiresAt,
            }),
          })
          .catch((err) =>
            log.error({ err, inviteId: invite.id }, "team-leader invite email failed")
          );
        emailSent = true;
      } catch (err) {
        log.warn({ err, inviteId: invite.id }, "team-leader invite email prep failed");
      }
    }

    return c.json(
      {
        id: invite.id,
        token: invite.token,
        teamName: invite.teamName,
        campaignId: invite.campaignId,
        expiresAt: invite.expiresAt.toISOString(),
        emailSent,
      },
      201
    );
  } catch (err) {
    log.error({ err }, "team invite create failed");
    return c.json({ error: "Kunde inte skapa inbjudan just nu." }, 500);
  }
});

// ── GET /team-invites/:token (public preview) ────────────────────
/**
 * Public read-only endpoint used by `/registrera/lagansvarig/[token]`
 * to render org + team info before the leader fills in their account.
 * Returns 404 if expired, used, or unknown — we don't leak why.
 */
association.get("/team-invites/:token", async (c) => {
  const token = c.req.param("token");
  if (!token || token.length < 16 || token.length > 64) {
    return c.json({ error: "Inbjudan hittades inte." }, 404);
  }

  try {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) return c.json({ error: "Inbjudan hittades inte." }, 404);
    if (invite.usedAt)
      return c.json({ error: "Inbjudan är redan använd." }, 410);
    if (invite.expiresAt.getTime() < Date.now())
      return c.json({ error: "Inbjudan har gått ut." }, 410);

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, invite.orgId))
      .limit(1);

    const [campaign] = await db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, invite.campaignId))
      .limit(1);

    return c.json({
      teamName: invite.teamName,
      invitedEmail: invite.invitedEmail,
      orgName: org?.name ?? "Okänd förening",
      campaignName: campaign?.name ?? "Okänd kampanj",
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (err) {
    log.error({ err }, "team invite preview failed");
    return c.json({ error: "Kunde inte hämta inbjudan just nu." }, 500);
  }
});

// ── POST /team-invites/claim (public) ────────────────────────────
/**
 * Public claim flow. The team leader posts their account details +
 * the invite token; we atomically create the user, create the team
 * with leader_id pointing at the new user, and mark the invite used.
 * A session cookie is set so the new leader lands on `/lag` already
 * logged in.
 */
association.post("/team-invites/claim", async (c) => {
  type Body = {
    token?: string;
    email?: string;
    password?: string;
    contactName?: string;
    phone?: string;
  };

  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const token = (body.token ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const contactName = (body.contactName ?? "").trim();
  const phone = body.phone?.trim() || null;

  if (!token || token.length < 16 || token.length > 64) {
    return c.json({ error: "Inbjudan hittades inte." }, 404);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Ogiltig e-postadress." }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return c.json({ error: "Lösenord måste vara 8–128 tecken." }, 400);
  }
  if (!contactName || contactName.length < 2) {
    return c.json({ error: "Namn krävs." }, 400);
  }

  try {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);
    if (!invite) return c.json({ error: "Inbjudan hittades inte." }, 404);
    if (invite.usedAt)
      return c.json({ error: "Inbjudan är redan använd." }, 410);
    if (invite.expiresAt.getTime() < Date.now())
      return c.json({ error: "Inbjudan har gått ut." }, 410);

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser) {
      return c.json({ error: "E-postadressen är redan registrerad." }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    const tx = await db.transaction(async (trx) => {
      const [user] = await trx
        .insert(users)
        .values({
          email,
          passwordHash,
          role: "TEAM_LEADER",
          orgId: invite.orgId,
          contactName,
          phone,
        })
        .returning();

      // Seller-invite token for *this* new team. Same shape as the
      // existing seller invite-flow (see `/registrera/saljare/[token]`).
      const sellerInviteToken = generateToken();

      const [team] = await trx
        .insert(teams)
        .values({
          orgId: invite.orgId,
          campaignId: invite.campaignId,
          leaderId: user.id,
          name: invite.teamName,
          inviteToken: sellerInviteToken,
        })
        .returning();

      await trx
        .update(teamInvites)
        .set({ usedAt: new Date(), usedByTeamId: team.id })
        .where(eq(teamInvites.id, invite.id));

      return { user, team };
    });

    const sessionData: SessionData = {
      userId: tx.user.id,
      role: "TEAM_LEADER",
      orgId: invite.orgId,
      createdAt: Date.now(),
    };
    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: tx.user.id,
      action: "association.team_invite.claimed",
      entityType: "team",
      entityId: tx.team.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        inviteId: invite.id,
        orgId: invite.orgId,
        campaignId: invite.campaignId,
      },
    });

    // MASTERPLAN_01 KC3.7: notifiera föreningsadmin som skapade
    // inbjudan att den nu är accepterad. Helt fire-and-forget — TL:s
    // session/cookie får inte hänga på email-providern.
    if (invite.createdByUserId) {
      void (async () => {
        try {
          const [admin] = await db
            .select({ email: users.email, contactName: users.contactName })
            .from(users)
            .where(eq(users.id, invite.createdByUserId!))
            .limit(1);
          if (!admin) return;

          const [campaign] = await db
            .select({ name: campaigns.name })
            .from(campaigns)
            .where(eq(campaigns.id, invite.campaignId))
            .limit(1);

          await getEmailSender().sendEmail({
            to: admin.email,
            ...teamLeaderClaimedEmail({
              adminName:
                admin.contactName?.split(" ")[0] ||
                admin.email.split("@")[0] ||
                "där",
              leaderName: contactName,
              leaderEmail: email,
              teamName: invite.teamName,
              campaignName: campaign?.name ?? "kampanjen",
              teamUrl: `${SITE_URL}/forening`,
            }),
          });
        } catch (err) {
          log.error(
            { err, inviteId: invite.id },
            "team-leader claimed notification failed"
          );
        }
      })();
    }

    return c.json(
      {
        ok: true,
        teamId: tx.team.id,
        redirect: "/lag",
      },
      201
    );
  } catch (err) {
    log.error({ err }, "team invite claim failed");
    return c.json({ error: "Kunde inte slutföra inbjudan just nu." }, 500);
  }
});

// ── POST /team-invites/:id/resend ────────────────────────────────
/**
 * MASTERPLAN_01 KC3.9: "skicka inbjudan igen". Använder samma email-
 * template + token som den ursprungliga inbjudan. Får INTE ge en ny
 * token (det skulle ogiltigförklara den TL eventuellt redan har i
 * sin inkorg). Får INTE skicka om inbjudan redan är claimad eller
 * utgången — då måste admin skapa en ny.
 *
 * Hastighetskrav är inte hårda — admins gör detta manuellt — men vi
 * lägger en mjuk gräns på 5 resends per 10 min per invite för att
 * inte trigga Resend-rate-limits ifall en admin spammar "Skicka igen".
 */
association.post("/team-invites/:id/resend", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!session.orgId) return c.json({ error: "Ingen organisation" }, 403);
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const inviteId = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return c.json({ error: "Ogiltigt ID." }, 400);
  }

  let body: { email?: string } = {};
  try {
    body = await c.req.json<{ email?: string }>();
  } catch {
    // Body är valfri — en tom POST betyder "skicka till den adress vi
    // redan har på inbjudan".
  }
  const overrideEmail = body.email?.trim().toLowerCase() || null;
  if (overrideEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideEmail)) {
    return c.json({ error: "Ogiltig e-postadress." }, 400);
  }

  try {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.id, inviteId))
      .limit(1);
    if (!invite) return c.json({ error: "Inbjudan hittades inte." }, 404);

    // Org-tenancy check. INTERNAL_ADMIN får överskrida.
    if (
      session.role !== "INTERNAL_ADMIN" &&
      invite.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }
    if (invite.usedAt) {
      return c.json({ error: "Inbjudan är redan accepterad." }, 410);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return c.json(
        { error: "Inbjudan har gått ut — skapa en ny istället." },
        410
      );
    }

    const targetEmail = overrideEmail ?? invite.invitedEmail;
    if (!targetEmail) {
      return c.json(
        { error: "Ingen e-postadress angiven på inbjudan." },
        400
      );
    }

    const [campaign] = await db
      .select({ name: campaigns.name, orgId: campaigns.orgId })
      .from(campaigns)
      .where(eq(campaigns.id, invite.campaignId))
      .limit(1);

    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, invite.orgId))
      .limit(1);

    const [inviter] = session.userId
      ? await db
          .select({ contactName: users.contactName, email: users.email })
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1)
      : [];

    const inviterName =
      inviter?.contactName ||
      inviter?.email?.split("@")[0] ||
      "Föreningsadmin";

    const inviteUrl = `${SITE_URL}/registrera/lagansvarig/${invite.token}`;

    // Spara override-adressen så efterföljande resends defaultar till
    // den nya adressen + UI:t kan visa "skickad till X".
    if (overrideEmail && overrideEmail !== invite.invitedEmail) {
      await db
        .update(teamInvites)
        .set({ invitedEmail: overrideEmail })
        .where(eq(teamInvites.id, invite.id));
    }

    void getEmailSender()
      .sendEmail({
        to: targetEmail,
        ...teamLeaderInviteEmail({
          inviterName,
          orgName: org?.name ?? "föreningen",
          campaignName: campaign?.name ?? "kampanjen",
          teamName: invite.teamName,
          inviteUrl,
          expiresAt: invite.expiresAt,
        }),
      })
      .catch((err) =>
        log.error(
          { err, inviteId: invite.id },
          "team-leader invite resend email failed"
        )
      );

    void auditLog({
      userId: session.userId,
      action: "association.team_invite.resent",
      entityType: "team_invite",
      entityId: invite.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: invite.orgId,
        targetEmail,
      },
    });

    return c.json({ ok: true, sentTo: targetEmail });
  } catch (err) {
    log.error({ err }, "team invite resend failed");
    return c.json({ error: "Kunde inte skicka inbjudan just nu." }, 500);
  }
});

// ── POST /campaigns ──────────────────────────────────────────────
/**
 * Create a new fundraising campaign owned by the calling
 * ASSOCIATION_ADMIN's org. Returns the created row so the UI can
 * navigate to it / show it in the list.
 */
association.post("/campaigns", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!session.orgId) return c.json({ error: "Ingen organisation" }, 403);
  if (session.role !== "ASSOCIATION_ADMIN" && session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  type Body = {
    name?: string;
    description?: string;
    story?: string;
    goalType?: "AMOUNT" | "PACKAGES";
    goalValue?: number;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;
    deliveryType?: "BULK" | "DIRECT" | "BOTH";
    marginPercent?: number;
  };

  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length < 3 || name.length > 255) {
    return c.json({ error: "Kampanjnamn måste vara 3–255 tecken." }, 400);
  }
  const goalType = body.goalType === "PACKAGES" ? "PACKAGES" : "AMOUNT";
  const goalValue = Math.max(0, Math.floor(body.goalValue ?? 0));

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = body.startDate ?? "";
  const endDate = body.endDate ?? "";
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    return c.json({ error: "Start- och slutdatum krävs (YYYY-MM-DD)." }, 400);
  }
  if (endDate < startDate) {
    return c.json({ error: "Slutdatum måste vara efter startdatum." }, 400);
  }

  const deliveryType =
    body.deliveryType === "DIRECT"
      ? "DIRECT"
      : body.deliveryType === "BOTH"
        ? "BOTH"
        : "BULK";
  const marginPercent = Math.min(
    100,
    Math.max(0, Math.floor(body.marginPercent ?? 25))
  );

  try {
    const slug = await ensureUniqueSlug(slugify(name));
    const [campaign] = await db
      .insert(campaigns)
      .values({
        orgId: session.orgId,
        name,
        slug,
        description: (body.description ?? "").slice(0, 1000),
        story: (body.story ?? "").slice(0, 4000),
        status: "ACTIVE",
        goalType,
        goalValue,
        startDate,
        endDate,
        deliveryType,
        marginPercent,
      })
      .returning();

    void auditLog({
      userId: session.userId,
      action: "association.campaign.created",
      entityType: "campaign",
      entityId: campaign.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: session.orgId,
      },
    });

    return c.json(
      {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        status: campaign.status,
      },
      201
    );
  } catch (err) {
    log.error({ err }, "campaign create failed");
    return c.json({ error: "Kunde inte skapa kampanj just nu." }, 500);
  }
});
