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
import { eq, and, sql, gt, isNull } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { db } from "@roots/db";
import {
  organizations,
  campaigns,
  teams,
  teamInvites,
  users,
  customerOrders,
} from "@roots/db/schema";
import { isDemoSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, createSession } from "../lib/session";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { auditLog, requestContext } from "../lib/audit";
import { teamInviteResendRateLimit } from "../lib/rate-limit";
import { validatePassword } from "./auth";
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

// P2.10 (audit 2026-05-26): tidigare hade association.ts en egen
// SESSION_COOKIE_OPTIONS med sameSite=Lax och egen maxAge. När web
// och API ligger på olika hosts i prod blockar Lax cookie-sättningen
// vid en cross-site POST → team-leader fastnade på inloggnings-
// modal direkt efter team-invite-claim. Vi använder nu den centrala
// import:en från session.ts (sameSite=none + secure i prod).

export const association = new Hono();

// ── helpers ──────────────────────────────────────────────────────
function generateToken(): string {
  // 32 chars of url-safe hex — collision-resistant + short enough for QR.
  return randomBytes(16).toString("hex");
}

/**
 * MASTERPLAN_01 KC3.1 — onboarding-status för ASSOCIATION_ADMIN.
 *
 * Returnerar en checklist som /forening/kom-igang renderar. Varje
 * `step` har en stabil `id` så att UI:t kan animera / fokusera den
 * specifika punkten utan att jämföra labels.
 *
 * Steps räknas som "completed" enligt:
 *   - `org_details`     — orgNumber satt i organizations
 *   - `campaign`        — minst en kampanj finns (oavsett status)
 *   - `team`            — minst ett team finns ELLER en pending invite
 *   - `team_leader`     — minst en TEAM_LEADER-user i org:en
 *   - `first_sale`      — minst en PAID customer-order
 *
 * `completed: true` om ALLA steg är klara. Front-end använder det för
 * att gömma onboarding-banner permanent.
 *
 * Snabb O(few small queries). Vi joinar inte — separata SELECT:s är
 * billigare + tydligare.
 */
association.get("/onboarding-status", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!session.orgId) return c.json({ error: "Ingen organisation" }, 403);
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    const orgId = session.orgId;

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        displayName: organizations.displayName,
        orgNumber: organizations.orgNumber,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return c.json({ error: "Organisation hittades inte." }, 404);

    // count() returnerar [{ c: <num> }] — vi använder `sql<number>` så
    // typen blir korrekt utan en explicit cast.
    const [campaignCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));

    const [teamCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(teams)
      .where(eq(teams.orgId, orgId));

    // Pending invites räknas som "team progress" så att admin som
    // skickat en TL-invite ser checken bockad även innan claim.
    const [pendingInviteCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.orgId, orgId),
          isNull(teamInvites.usedAt),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    // P3.31 (audit 2026-05-26): exkludera GDPR-purgade users så
    // onboarding-checklistan inte räknar tombstones som aktiva ledare.
    const [teamLeaderCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.role, "TEAM_LEADER"),
          isNull(users.deletedAt)
        )
      );

    const [paidOrderCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.orgId, orgId),
          eq(customerOrders.status, "PAID")
        )
      );

    const hasOrgDetails = Boolean(org.orgNumber);
    const hasCampaign = (campaignCount?.c ?? 0) > 0;
    const hasTeam =
      (teamCount?.c ?? 0) > 0 || (pendingInviteCount?.c ?? 0) > 0;
    const hasTeamLeader = (teamLeaderCount?.c ?? 0) > 0;
    const firstSaleMade = (paidOrderCount?.c ?? 0) > 0;

    const steps = [
      {
        id: "org_details" as const,
        label: "Fyll i föreningens uppgifter",
        description:
          "Vi behöver organisationsnummer för att kunna fakturera och göra utbetalningar.",
        completed: hasOrgDetails,
        ctaHref: "/forening/installningar",
        ctaLabel: hasOrgDetails ? "Visa uppgifter" : "Fyll i nu",
      },
      {
        id: "campaign" as const,
        label: "Starta din första kampanj",
        description:
          "Sätt mål, start- och slutdatum. Den blir er gemensamma försäljningsperiod.",
        completed: hasCampaign,
        ctaHref: "/forening?openCampaign=1",
        ctaLabel: hasCampaign ? "Hantera kampanj" : "Starta kampanj",
      },
      {
        id: "team" as const,
        label: "Skapa eller bjud in ett lag",
        description:
          "Lagansvariga bjuder sedan in säljare. Du kan börja med ett enda lag.",
        completed: hasTeam,
        ctaHref: "/forening/lag",
        ctaLabel: hasTeam ? "Hantera lag" : "Skapa lag",
      },
      {
        id: "team_leader" as const,
        label: "Få en lagansvarig på plats",
        description:
          "När någon klickar på er invite-länk och registrerar sig får ni en lagansvarig.",
        completed: hasTeamLeader,
        ctaHref: "/forening/lag",
        ctaLabel: hasTeamLeader ? "Visa lagansvariga" : "Visa pågående inbjudningar",
      },
      {
        id: "first_sale" as const,
        label: "Få in er första betalda order",
        description:
          "När er första säljare har stängt en order syns den här — då är ni igång på riktigt.",
        completed: firstSaleMade,
        ctaHref: "/forening/avrakning",
        ctaLabel: firstSaleMade ? "Visa beställningar" : "Tips för att komma igång",
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const completed = completedCount === steps.length;

    return c.json({
      orgId,
      orgName: org.displayName ?? org.name,
      completed,
      completedCount,
      totalSteps: steps.length,
      steps,
    });
  } catch (err) {
    log.error({ err, orgId: session.orgId }, "onboarding-status failed");
    return c.json({ error: "Kunde inte hämta onboarding-status." }, 500);
  }
});

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
  // P3.29 (audit 2026-05-26): demo-konton ska inte muta:a DB.
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte skapa inbjudningar." }, 403);
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
  // Pre-push fix 2026-05-26: tidigare tillät claim 8-tecken-lösenord,
  // medan resten av plattformen kräver minst 12 tecken via
  // validatePassword. Inbjudna team-leaders ska följa samma policy.
  const pwErr = validatePassword(password);
  if (pwErr) {
    return c.json({ error: pwErr }, 400);
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

    // P1.6 (audit 2026-05-26): TOCTOU-skydd. Pre-checken ovan är inte
    // tillräcklig — två samtidiga POST:s med samma token kunde tidigare
    // båda skapa users/teams innan någon hann markera inviten som
    // använd. Vi gate:ar nu på det faktiska redemption-steget med en
    // konditional UPDATE `WHERE used_at IS NULL` inuti tx:n. Den som
    // får 0 raden tappade race:n och får 410 utan att ha bränt en
    // user-row.
    let raceLost = false;
    let tx: { user: { id: string }; team: { id: string } } | null = null;
    try {
      tx = await db.transaction(async (trx) => {
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

        const claimedRows = await trx
          .update(teamInvites)
          .set({ usedAt: new Date(), usedByTeamId: team.id })
          .where(
            and(eq(teamInvites.id, invite.id), isNull(teamInvites.usedAt))
          )
          .returning({ id: teamInvites.id });

        if (claimedRows.length === 0) {
          // Annan request hann före — rulla tillbaka hela tx:n så
          // ingen user/team läcker.
          raceLost = true;
          throw new Error("invite_already_claimed");
        }

        return { user, team };
      });
    } catch (err) {
      if (raceLost) {
        return c.json({ error: "Inbjudan är redan använd." }, 410);
      }
      throw err;
    }
    if (!tx) {
      return c.json({ error: "Kunde inte slutföra inbjudan just nu." }, 500);
    }

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
  // Scout fix 2026-05-26 (Auth-C2): demo-konton kunde tidigare
  // resend:a riktiga invite-mail.
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte skicka inbjudningar." }, 403);
  }

  const inviteId = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return c.json({ error: "Ogiltigt ID." }, 400);
  }

  // P3.26 (audit 2026-05-26): kommentaren ovan utlovar 5 resends/10 min/
  // invite men ingen guard fanns. Lägg den nu — räcker för normala
  // admins men stoppar "spamma Skicka igen"-knappen.
  const rl = await teamInviteResendRateLimit(inviteId);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många försök att skicka om denna inbjudan. Vänta en stund." },
      429
    );
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
  // P3.29 (audit 2026-05-26): demo-konton ska inte muta:a DB.
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte skapa kampanjer." }, 403);
  }

  type Body = {
    name?: string;
    description?: string;
    story?: string;
    goalType?: "AMOUNT" | "PACKAGES";
    goalValue?: number;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;
    deliveryDate?: string; // YYYY-MM-DD, leverans till klubben
    allowSalesOutsidePeriod?: boolean;
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

  // Valfritt leveransdatum till klubben (måste vara giltigt om angivet).
  let deliveryDate: string | null = null;
  if (body.deliveryDate) {
    if (!datePattern.test(body.deliveryDate)) {
      return c.json({ error: "Leveransdatum måste vara YYYY-MM-DD." }, 400);
    }
    deliveryDate = body.deliveryDate;
  }
  const allowSalesOutsidePeriod = body.allowSalesOutsidePeriod !== false;

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
        deliveryDate,
        allowSalesOutsidePeriod,
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
