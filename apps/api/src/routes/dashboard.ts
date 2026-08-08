import { Hono } from "hono";
import { eq, and, sql, inArray, gte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { db } from "@roots/db";
import {
  campaigns,
  teams,
  sellers,
  users,
  customerOrders,
  customerOrderLines,
  teamGoals,
  products,
  payouts,
} from "@roots/db/schema";
import { REVENUE_ORDER_STATUSES, countsAsRevenue } from "@roots/contracts";
import { isDemoSession } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { getAchievedMilestones, getNextMilestone, getSellerGrade } from "../lib/milestones";
import { getEmailSender } from "../lib/email";
import { welcomeEmail } from "../lib/email/templates";
import { childLogger } from "../lib/logger";
import { stockholmDateIso } from "../lib/date";
import { auditLog, requestContext } from "../lib/audit";
import { resolveCampaignCatalog } from "../lib/campaign-catalog";
import { validatePassword } from "./auth";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import { localizedProductName } from "../lib/product-i18n";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const log = childLogger("dashboard");

export const dashboard = new Hono();

/**
 * Får den inloggade användaren bekräfta den här manuella ordern?
 *
 * Samma villkor som POST /orders/:orderId/verify faktiskt tillämpar. Vi
 * svarar på frågan i orderlistan i stället för att låta varje vy räkna ut
 * den själv: en vy som gissar fel visar antingen en knapp som ger 403,
 * eller ingen knapp åt någon som hade fått bekräfta.
 *
 * Den viktigaste raden är den sista. Den som registrerat ordern får inte
 * godkänna den — annars är kontrollen meningslös för precis det scenario
 * den finns till för.
 */
function canVerifyManualOrder(
  session: { userId: string; role: string; orgId: string | null },
  order: { isManual: boolean; orgId: string; placedByUserId: string | null },
  team: { leaderId: string | null }
): boolean {
  if (!order.isManual) return false;
  const inScope =
    session.role === "INTERNAL_ADMIN" ||
    (session.role === "ASSOCIATION_ADMIN" && session.orgId === order.orgId) ||
    (session.role === "TEAM_LEADER" && team.leaderId === session.userId);
  if (!inScope) return false;
  return order.placedByUserId !== session.userId;
}

/* ───────────────────────── Statistik / grafer ─────────────────────────
 * Tidsserie-data för dashboard-graferna. Alla aggregat filtrerar på
 * PAID + countsTowardStats=true (samma regel som KPI-aggregaten ovan) så
 * graferna och siffrorna alltid stämmer överens. Endpoints returnerar
 * självständig data så varje statistik-sida klarar sig med ETT anrop.
 * ------------------------------------------------------------------- */

const STATS_WINDOW_DAYS = 90;
// REVENUE_ORDER_STATUSES i stället för bara "PAID": leveransstatus skriver
// över betalstatus i samma kolumn, så ett `= 'PAID'` tappade varje order
// som hunnit markeras som skickad eller levererad. Grafer och KPI:er visade
// då mindre än laget faktiskt sålt.
const PAID_IN_STATS = and(
  inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
  eq(customerOrders.countsTowardStats, true)
);

/** Tidigaste datum vi tar med i tidsserien. */
function statsSince(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - STATS_WINDOW_DAYS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Daglig försäljning (öre) + antal ordrar för ett godtyckligt scope. */
async function dailySeries(scope: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${customerOrders.createdAt}), 'YYYY-MM-DD')`,
      salesOre: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(customerOrders)
    .where(and(scope, PAID_IN_STATS, gte(customerOrders.createdAt, statsSince())))
    .groupBy(sql`date_trunc('day', ${customerOrders.createdAt})`)
    .orderBy(sql`date_trunc('day', ${customerOrders.createdAt})`);
  return rows.map((r) => ({
    day: r.day,
    salesOre: Number(r.salesOre),
    orders: Number(r.orders),
  }));
}

/** Försäljning per betalmetod (Swish/Klarna/Kort/Kontant) för ett scope. */
async function paymentSeries(scope: ReturnType<typeof and> | undefined) {
  const methodExpr = sql<string>`LOWER(COALESCE(NULLIF(${customerOrders.selectedPaymentMethod}, ''), ${customerOrders.paymentMethod}::text, 'okänd'))`;
  const rows = await db
    .select({
      method: methodExpr,
      salesOre: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(customerOrders)
    .where(and(scope, PAID_IN_STATS))
    .groupBy(methodExpr)
    .orderBy(sql`COALESCE(SUM(${customerOrders.totalOre}), 0) DESC`);
  return rows.map((r) => ({
    method: r.method,
    salesOre: Number(r.salesOre),
    count: Number(r.count),
  }));
}

/** Försäljning per veckodag (0=söndag … 6=lördag). */
async function weekdaySeries(
  scope: ReturnType<typeof and> | undefined,
  locale: "sv" | "en" = "sv"
) {
  const dowExpr = sql<number>`EXTRACT(DOW FROM ${customerOrders.createdAt})`;
  const rows = await db
    .select({
      dow: dowExpr,
      salesOre: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(customerOrders)
    .where(and(scope, PAID_IN_STATS, gte(customerOrders.createdAt, statsSince())))
    .groupBy(dowExpr);
  const byDow = new Map(rows.map((r) => [Number(r.dow), Number(r.salesOre)]));
  // Returnera må–sö (Mon–Sun) in calendar order.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels =
    locale === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
  return order.map((dow, i) => ({
    label: labels[i],
    salesOre: byDow.get(dow) ?? 0,
  }));
}

dashboard.get("/association", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (!session.orgId) return c.json({ error: uiError(locale, "noOrganisation") }, 403);

  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  const orgId = session.orgId;

  try {
    const campaignList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));

    const teamList = await db
      .select()
      .from(teams)
      .where(eq(teams.orgId, orgId));

    const sellerList = await db
      .select({
        id: sellers.id,
        displayName: sellers.displayName,
        teamId: sellers.teamId,
        shopSlug: sellers.shopSlug,
      })
      .from(sellers)
      .innerJoin(teams, eq(sellers.teamId, teams.id))
      .where(eq(teams.orgId, orgId));

    const salesByTeam = await db
      .select({
        teamId: customerOrders.teamId,
        total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.orgId, orgId),
          inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
          // Endast ordrar inom säljperioden räknas i statistik/topplistor.
          eq(customerOrders.countsTowardStats, true)
        )
      )
      .groupBy(customerOrders.teamId);

    const totalSales = salesByTeam.reduce((s, r) => s + Number(r.total), 0);
    const totalOrders = salesByTeam.reduce((s, r) => s + Number(r.count), 0);

    const goals = await db
      .select()
      .from(teamGoals)
      .innerJoin(teams, eq(teamGoals.teamId, teams.id))
      .where(eq(teams.orgId, orgId));

    return c.json({
      campaigns: campaignList,
      teams: teamList.map((t) => {
        const sales = salesByTeam.find((s) => s.teamId === t.id);
        const goal = goals.find((g) => g.team_goals.teamId === t.id);
        return {
          id: t.id,
          name: t.name,
          // Räkna säljarna vi faktiskt hämtat i stället för att lita på
          // `teams.memberCount`. Den kolumnen ökas vid registrering men
          // minskas aldrig, så den drev iväg: dashboarden visade "Säljare 3"
          // i KPI:n (riktiga rader) och "5 säljare" på lagraden (räknaren).
          memberCount: sellerList.filter((s) => s.teamId === t.id).length,
          leaderId: t.leaderId,
          totalSalesOre: Number(sales?.total || 0),
          orderCount: Number(sales?.count || 0),
          goalValue: goal?.team_goals.goalValue || 0,
          // P2.11 (audit 2026-05-26): tidigare läckte vi seller-
          // invite-token rakt i dashboard-payloaden för alla
          // ASSOCIATION_ADMIN-sessioner. En komprometterad admin-
          // cookie räckte för att skörda alla teams seller-tokens
          // och spam-registrera fake sellers. Skicka bara en
          // boolean — token rotateras/hämtas via dedikerad endpoint.
          hasInviteToken: Boolean(t.inviteToken),
        };
      }),
      sellers: sellerList,
      stats: { totalSalesOre: totalSales, totalOrders },
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch association dashboard");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});

// Sprint E12: ASSOCIATION_ADMIN sets per-team goals from /forening/mal.
// Reuses the existing `team_goals` table (unique on team_id+campaign_id)
// instead of adding a column to `teams`, so the data model stays aligned
// with the tRPC `campaigns.setGoal` path that already exists.
dashboard.patch("/association/team-goals", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (!session.orgId) return c.json({ error: uiError(locale, "noOrganisation") }, 403);
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  // P3.29 (audit 2026-05-26): demo-konton ska inte muta:a DB.
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotChangeTeamGoals") }, 403);
  }

  type Body = {
    teamId?: string;
    campaignId?: string;
    goalValue?: number;
    goalType?: "AMOUNT" | "PACKAGES";
  };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const teamId = (body.teamId ?? "").trim();
  const campaignId = (body.campaignId ?? "").trim();
  const goalValue = Number(body.goalValue);
  const goalType = body.goalType === "PACKAGES" ? "PACKAGES" : "AMOUNT";
  if (!teamId || !campaignId) {
    return c.json({ error: uiError(locale, "teamIdAndCampaignIdRequired") }, 400);
  }
  if (!Number.isFinite(goalValue) || goalValue < 0) {
    return c.json({ error: uiError(locale, "goalValuePositive") }, 400);
  }

  try {
    // Tenancy: a non-admin association admin must only edit goals for
    // their own teams. Verify both team and campaign belong to org.
    const [team] = await db
      .select({ id: teams.id, orgId: teams.orgId, campaignId: teams.campaignId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundThe") }, 404);
    if (
      session.role !== "INTERNAL_ADMIN" &&
      team.orgId !== session.orgId
    ) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }
    // Laget måste tillhöra kampanjen målet sätts för — annars kan en
    // (teamId, campaignId)-rad skapas för fel kombination och förvränga
    // statistiken.
    if (team.campaignId !== campaignId) {
      return c.json(
        { error: uiError(locale, "teamNotInCampaign") },
        400
      );
    }

    const [campaign] = await db
      .select({ id: campaigns.id, orgId: campaigns.orgId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return c.json({ error: uiError(locale, "campaignNotFoundThe") }, 404);
    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    await db
      .insert(teamGoals)
      .values({
        teamId,
        campaignId,
        goalType,
        goalValue: Math.floor(goalValue),
      })
      .onConflictDoUpdate({
        target: [teamGoals.teamId, teamGoals.campaignId],
        set: {
          goalType,
          goalValue: Math.floor(goalValue),
        },
      });

    return c.json({ ok: true, teamId, campaignId, goalValue, goalType });
  } catch (err) {
    log.error({ err }, "Failed to upsert team goal");
    return c.json({ error: uiError(locale, "couldNotSaveGoal") }, 500);
  }
});

dashboard.get("/my-team", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.leaderId, session.userId))
      .limit(1);

    if (!team) return c.json({ error: uiError(locale, "noTeamFound") }, 404);

    return c.json({ teamId: team.id });
  } catch (err) {
    log.error({ err }, "Failed to fetch my-team");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});

dashboard.get("/team/:teamId", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  const teamId = c.req.param("teamId");

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    const sellerList = await db
      .select()
      .from(sellers)
      .where(eq(sellers.teamId, teamId));

    const salesBySeller = await db
      .select({
        sellerId: customerOrders.sellerId,
        total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.teamId, teamId),
          inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
          eq(customerOrders.countsTowardStats, true)
        )
      )
      .groupBy(customerOrders.sellerId);

    const orders = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.teamId, teamId))
      .orderBy(customerOrders.createdAt);

    const totalSales = salesBySeller.reduce((s, r) => s + Number(r.total), 0);
    const totalOrderCount = salesBySeller.reduce((s, r) => s + Number(r.count), 0);

    // Villkoret speglar settlement.ts: en manuell order som är betald men
    // obekräftad räknas i statistiken men hålls utanför utbetalningen.
    // Skulle de två någon gång glida ifrån varandra visar lagledaren en
    // siffra som avräkningen inte känner igen, så de hör ihop.
    const unverifiedManual = orders.reduce(
      (acc, o) => {
        if (o.isManual && countsAsRevenue(o.status) && !o.verifiedAt) {
          acc.ore += o.totalOre;
          acc.count += 1;
        }
        return acc;
      },
      { ore: 0, count: 0 }
    );

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, team.campaignId))
      .limit(1);

    const marginPercent = campaign?.marginPercent ?? 25;
    const teamEarningsOre = Math.round(totalSales * (marginPercent / 100));
    const goalOre = campaign?.goalType === "AMOUNT" && campaign?.goalValue ? campaign.goalValue * 100 : undefined;
    const goalPackages = campaign?.goalType === "PACKAGES" && campaign?.goalValue ? campaign.goalValue : undefined;
    const achieved = getAchievedMilestones(
      totalSales,
      totalOrderCount,
      goalOre,
      goalPackages,
      locale
    );
    const next = getNextMilestone(
      totalSales,
      totalOrderCount,
      goalOre,
      goalPackages,
      locale
    );

    return c.json({
      team,
      campaign: campaign
        ? { ...campaign, marginPercent: campaign.marginPercent }
        : null,
      sellers: sellerList.map((s) => {
        const sales = salesBySeller.find((ss) => ss.sellerId === s.id);
        const sellerSalesOre = Number(sales?.total || 0);
        return {
          id: s.id,
          displayName: s.displayName,
          shopSlug: s.shopSlug,
          totalSalesOre: sellerSalesOre,
          orderCount: Number(sales?.count || 0),
          individualGoal: s.individualGoal,
          grade: getSellerGrade(sellerSalesOre, locale),
          // Sprint E12: surface status so /lag/saljare can show paused
          // sellers separately and hide them from the live ranking.
          status: s.status,
        };
      }),
      orders: orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        totalOre: o.totalOre,
        status: o.status,
        paymentMethod: o.paymentMethod,
        selectedPaymentMethod: o.selectedPaymentMethod,
        deliveryType: o.deliveryType,
        sellerId: o.sellerId,
        isManual: o.isManual,
        countsTowardStats: o.countsTowardStats,
        createdAt: o.createdAt,
        // En obekräftad manuell order räknas inte in i någon utbetalning.
        // Utan det här fältet kan gränssnittet inte skilja på "väntar på
        // dig" och "klar", och lagledaren har ingen aning om varför
        // avräkningen är lägre än vad laget sagt.
        verifiedAt: o.verifiedAt,
        // Reglerna för vem som får bekräfta bor i verify-endpointen. Vi
        // svarar hellre på frågan här än låter varje vy försöka räkna ut
        // dem igen och riskera att gissa fel.
        canVerify: canVerifyManualOrder(session, o, team),
      })),
      stats: {
        totalSalesOre: totalSales,
        totalOrders: totalOrderCount,
        teamEarningsOre,
        marginPercent,
        // Summan som väntar på bekräftelse, så avräkningsvyn kan visa
        // varför den skiljer sig från lagets egen räkning i stället för
        // att bara redovisa ett lägre tal.
        unverifiedManualOre: unverifiedManual.ore,
        unverifiedManualCount: unverifiedManual.count,
      },
      milestones: {
        achieved: achieved.map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
        })),
        next: next
          ? { id: next.id, label: next.label, remaining: next.remaining }
          : null,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch team dashboard");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});

// Sprint E10: update a seller's individual goal. Access rules mirror
// the team-level RBAC used in `/team/:teamId/sellers` above — only the
// team's own leader, the team's association admin, or an internal admin
// can change the goal. We only allow `individualGoal` (in kronor) so a
// bug in the UI can't accidentally PATCH e.g. role or shopSlug.
dashboard.patch("/sellers/:sellerId", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  // MASTERPLAN_01 KC2.1: en demo-INTERNAL_ADMIN passerar role-checken
  // nedan men skulle annars kunna ändra status på en RIKTIG säljare
  // (t.ex. inaktivera dem). Stoppa innan vi rör DB.
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(locale, "demoCannotChangeSellers") },
      403
    );
  }

  const sellerId = c.req.param("sellerId");
  if (!/^[0-9a-f-]{36}$/i.test(sellerId)) {
    return c.json({ error: uiError(locale, "invalidSellerId") }, 400);
  }

  // Sprint E12: this endpoint now also handles seller status changes
  // (ACTIVE / INACTIVE). Either field may be present; at least one must
  // be. Inactivating a seller hides them from team ranking + goal totals
  // — see /v1/dashboard/team/:teamId aggregation logic.
  let body: { individualGoal?: number; status?: "ACTIVE" | "INACTIVE" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const goalRaw = body.individualGoal;
  const statusRaw = body.status;

  const wantsGoal = goalRaw !== undefined;
  const wantsStatus = statusRaw !== undefined;

  if (!wantsGoal && !wantsStatus) {
    return c.json(
      { error: uiError(locale, "individualGoalOrStatusRequired") },
      400
    );
  }

  if (wantsGoal) {
    if (
      !Number.isFinite(goalRaw) ||
      !Number.isInteger(goalRaw) ||
      (goalRaw as number) < 0 ||
      (goalRaw as number) > 10_000_000
    ) {
      return c.json(
        { error: uiError(locale, "individualGoalRange") },
        400
      );
    }
  }

  if (wantsStatus && statusRaw !== "ACTIVE" && statusRaw !== "INACTIVE") {
    return c.json(
      { error: uiError(locale, "statusActiveOrInactive") },
      400
    );
  }

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.id, sellerId))
      .limit(1);
    if (!seller) return c.json({ error: uiError(locale, "sellerNotFound") }, 404);

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    const patch: { individualGoal?: number; status?: "ACTIVE" | "INACTIVE"; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (wantsGoal) patch.individualGoal = goalRaw as number;
    if (wantsStatus) patch.status = statusRaw as "ACTIVE" | "INACTIVE";

    const [updated] = await db
      .update(sellers)
      .set(patch)
      .where(eq(sellers.id, sellerId))
      .returning();

    return c.json({
      id: updated.id,
      individualGoal: updated.individualGoal,
      status: updated.status,
    });
  } catch (err) {
    log.error({ err }, "Failed to update seller");
    return c.json({ error: uiError(locale, "couldNotUpdateSeller") }, 500);
  }
});

dashboard.post("/team/:teamId/sellers", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  // MASTERPLAN_01 KC2.1: skapar riktig users-rad + säljare + skickar
  // welcome-email. Demo får inte trigga det.
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(locale, "demoCannotCreateSellers") },
      403
    );
  }

  const teamId = c.req.param("teamId");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const { displayName, email, password } = body;
  if (!displayName || !email || !password) {
    return c.json({ error: uiError(locale, "nameEmailPasswordRequired") }, 400);
  }
  // Scout fix 2026-05-26 (Auth-H4): tidigare hashades lösenordet
  // direkt utan styrkekontroll, vilket lät en team-leader skapa
  // säljare med svaga lösenord (kringgår 12-tecken-policyn i
  // /auth/register + /change-password).
  const passwordError = validatePassword(password, locale);
  if (passwordError) {
    return c.json({ error: passwordError }, 400);
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: uiError(locale, "emailAlreadyRegistered") }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);
    const shopSlug =
      displayName.toLowerCase().replace(/[^a-z0-9]/g, "-") +
      "-" +
      crypto.randomUUID().slice(0, 6);

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "SELLER",
          orgId: team.orgId,
          contactName: displayName,
        })
        .returning();

      const [seller] = await tx
        .insert(sellers)
        .values({
          userId: user.id,
          teamId: team.id,
          campaignId: team.campaignId,
          shopSlug,
          displayName,
        })
        .returning();

      await tx
        .update(teams)
        .set({ memberCount: sql`${teams.memberCount} + 1` })
        .where(eq(teams.id, team.id));

      return { user, seller };
    });

    getEmailSender()
      .sendEmail({
        to: result.user.email,
        ...welcomeEmail(displayName, "SELLER", locale),
      })
      .catch((e) => log.error({ err: e }, "Seller invite email failed"));

    return c.json({
      ok: true,
      seller: {
        id: result.seller.id,
        displayName: result.seller.displayName,
        shopSlug: result.seller.shopSlug,
        totalSalesOre: 0,
        orderCount: 0,
        individualGoal: 0,
        grade: getSellerGrade(0, locale),
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to create seller inline");
    return c.json({ error: uiError(locale, "couldNotCreateSeller") }, 500);
  }
});

/**
 * MASTERPLAN_02: bulk-import av säljare från Excel/CSV.
 *
 * Föreningen/lagledaren laddar upp en lista (namn + e-post). Vi skapar
 * ett konto per rad med ett genererat temporärt lösenord och returnerar
 * lösenorden till den inloggade administratören så de kan delas ut. Varje
 * säljare kan byta lösenord efter första inloggningen.
 *
 * Body: { rows: [{ displayName: string, email: string }] }  (max 2000)
 *
 * Säkerhet: temp-lösenord returneras ENDAST till den autentiserade
 * lagledaren/admin som skapade kontona (över HTTPS), aldrig publikt.
 * Alternativ utan utdelning av lösenord är registreringslänken
 * (team.inviteToken → /registrera/saljare/:token).
 */
dashboard.post("/team/:teamId/sellers/import", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotImportSellers") }, 403);
  }

  const teamId = c.req.param("teamId");
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) {
    return c.json({ error: uiError(locale, "invalidTeamId") }, 400);
  }

  let body: { rows?: Array<{ displayName?: string; email?: string }> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const rawRows = Array.isArray(body?.rows) ? body.rows : [];
  if (rawRows.length === 0) {
    return c.json({ error: uiError(locale, "noRowsToImport") }, 400);
  }
  if (rawRows.length > 2000) {
    return c.json({ error: uiError(locale, "max2000ImportRows") }, 400);
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);
    if (!hasAccess) return c.json({ error: uiError(locale, "permissionDenied") }, 403);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Normalisera + validera rader, dedup:a inom batchen.
    type Parsed = { displayName: string; email: string };
    const parsed: Parsed[] = [];
    const results: Array<{
      email: string;
      displayName: string;
      status: "created" | "skipped" | "error";
      reason?: string;
      tempPassword?: string;
      shopSlug?: string;
    }> = [];
    const seenInBatch = new Set<string>();

    for (const row of rawRows) {
      const displayName = String(row?.displayName ?? "").trim();
      const email = String(row?.email ?? "").trim().toLowerCase();
      if (!displayName || !email) {
        results.push({
          email,
          displayName,
          status: "error",
          reason: uiError(locale, "importNameEmailRequired"),
        });
        continue;
      }
      if (!emailRe.test(email) || email.length > 254) {
        results.push({
          email,
          displayName,
          status: "error",
          reason: uiError(locale, "importInvalidEmail"),
        });
        continue;
      }
      if (seenInBatch.has(email)) {
        results.push({
          email,
          displayName,
          status: "skipped",
          reason: uiError(locale, "importDuplicateInFile"),
        });
        continue;
      }
      seenInBatch.add(email);
      parsed.push({ displayName, email });
    }

    // Hitta befintliga konton i ett svep.
    const existingEmails = new Set<string>();
    if (parsed.length > 0) {
      const found = await db
        .select({ email: users.email })
        .from(users)
        .where(
          inArray(
            users.email,
            parsed.map((p) => p.email)
          )
        );
      for (const f of found) existingEmails.add(f.email);
    }

    let createdCount = 0;
    const welcomeQueue: Array<{ email: string; displayName: string }> = [];

    for (const p of parsed) {
      if (existingEmails.has(p.email)) {
        results.push({
          email: p.email,
          displayName: p.displayName,
          status: "skipped",
          reason: uiError(locale, "importEmailAlreadyRegistered"),
        });
        continue;
      }
      try {
        // 18 hex-tecken = >12-teckenpolicyn, läsbart att läsa upp.
        const tempPassword =
          crypto.randomUUID().replace(/-/g, "").slice(0, 14) + "9A";
        const passwordHash = await hash(tempPassword, ARGON2_OPTIONS);
        const shopSlug =
          p.displayName.toLowerCase().replace(/[^a-z0-9]/g, "-") +
          "-" +
          crypto.randomUUID().slice(0, 6);

        await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              email: p.email,
              passwordHash,
              role: "SELLER",
              orgId: team.orgId,
              contactName: p.displayName,
            })
            .returning();
          await tx.insert(sellers).values({
            userId: user.id,
            teamId: team.id,
            campaignId: team.campaignId,
            shopSlug,
            displayName: p.displayName,
          });
          await tx
            .update(teams)
            .set({ memberCount: sql`${teams.memberCount} + 1` })
            .where(eq(teams.id, team.id));
        });

        createdCount++;
        welcomeQueue.push({ email: p.email, displayName: p.displayName });
        results.push({
          email: p.email,
          displayName: p.displayName,
          status: "created",
          tempPassword,
          shopSlug,
        });
      } catch (err) {
        log.error({ err, email: p.email }, "Seller import row failed");
        results.push({
          email: p.email,
          displayName: p.displayName,
          status: "error",
          reason: uiError(locale, "importCreateFailed"),
        });
      }
    }

    // Välkomstmail (best-effort, blockar inte svaret).
    for (const w of welcomeQueue) {
      getEmailSender()
        .sendEmail({
          to: w.email,
          ...welcomeEmail(w.displayName, "SELLER", locale),
        })
        .catch((e) => log.error({ err: e }, "Import welcome email failed"));
    }

    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return c.json({
      ok: true,
      summary: { created: createdCount, skipped, errors, total: rawRows.length },
      results,
    });
  } catch (err) {
    log.error({ err }, "Seller import failed");
    return c.json({ error: uiError(locale, "couldNotImportSellers") }, 500);
  }
});

/**
 * MASTERPLAN_01 KC3.4: rotera säljar-invite-token för ett lag.
 *
 * Behörighet:
 *   - TEAM_LEADER (om de leder laget)
 *   - ASSOCIATION_ADMIN (samma org)
 *   - INTERNAL_ADMIN
 *
 * Body (alla optional):
 *   - expiresInDays?: number   (default 30, max 365, 0 = ingen utgång)
 *   - maxUses?: number         (default null = obegränsat)
 *
 * Sidoeffekter:
 *   - Genererar ny token (gamla blir omedelbart ogiltig).
 *   - Nollar inviteTokenUseCount till 0.
 *   - Sätter inviteTokenCreatedAt till now.
 *   - Audit-loggar rotationen (vem, varför inte — vi vet bara att den hänt).
 *
 * Demo-block redan upptaget av isDemoSession (importerades i KC2.1).
 */
dashboard.post("/team/:teamId/rotate-invite-token", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(locale, "demoCannotRotateInviteTokens") },
      403
    );
  }

  const teamId = c.req.param("teamId");
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) {
    return c.json({ error: uiError(locale, "invalidTeamId") }, 400);
  }

  let body: { expiresInDays?: number; maxUses?: number; locale?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    // Body är valfri.
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  // expiresInDays: 0 = "ingen utgång", default 30, cap 365 för att
  // motverka oavsiktlig "evig token".
  const rawDays =
    typeof body.expiresInDays === "number" && Number.isFinite(body.expiresInDays)
      ? Math.floor(body.expiresInDays)
      : 30;
  if (rawDays < 0 || rawDays > 365) {
    return c.json(
      { error: uiError(locale, "expiresInDaysRange") },
      400
    );
  }
  const expiresAt =
    rawDays === 0 ? null : new Date(Date.now() + rawDays * 24 * 60 * 60 * 1000);

  // maxUses: positiv int eller null. 0 vore "inga användningar"
  // vilket är meningslöst → behandla som 400.
  const rawMaxUses = body.maxUses;
  let maxUses: number | null = null;
  if (rawMaxUses !== undefined && rawMaxUses !== null) {
    if (
      typeof rawMaxUses !== "number" ||
      !Number.isFinite(rawMaxUses) ||
      rawMaxUses < 1 ||
      rawMaxUses > 10_000
    ) {
      return c.json(
        { error: uiError(locale, "maxUsesRange") },
        400
      );
    }
    maxUses = Math.floor(rawMaxUses);
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);
    if (!hasAccess) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    // 32 chars hex = 128 bits entropy. Samma form som existerande
    // tokens (auth.ts:711) så frontenden inte ser någon skillnad.
    const newToken = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const now = new Date();

    const [updated] = await db
      .update(teams)
      .set({
        inviteToken: newToken,
        inviteTokenExpiresAt: expiresAt,
        inviteTokenMaxUses: maxUses,
        inviteTokenUseCount: 0,
        inviteTokenCreatedAt: now,
        updatedAt: now,
      })
      .where(eq(teams.id, teamId))
      .returning();

    void auditLog({
      userId: session.userId,
      action: "team.invite_token.rotated",
      entityType: "team",
      entityId: teamId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: team.orgId,
        expiresAt: expiresAt?.toISOString() ?? null,
        maxUses,
      },
    });

    return c.json({
      ok: true,
      inviteToken: updated.inviteToken,
      expiresAt: updated.inviteTokenExpiresAt?.toISOString() ?? null,
      maxUses: updated.inviteTokenMaxUses,
      useCount: 0,
      rotatedAt: updated.inviteTokenCreatedAt.toISOString(),
    });
  } catch (err) {
    log.error({ err }, "team invite-token rotate failed");
    return c.json({ error: uiError(locale, "couldNotRotateInviteLink") }, 500);
  }
});

dashboard.get("/seller", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);

    if (!seller) return c.json({ error: uiError(locale, "noSellerProfile") }, 404);

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    const salesResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.sellerId, seller.id),
          inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
          eq(customerOrders.countsTowardStats, true)
        )
      );

    const orders = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.sellerId, seller.id))
      .orderBy(customerOrders.createdAt);

    const totalSalesOre = Number(salesResult[0]?.total || 0);
    const orderCount = Number(salesResult[0]?.count || 0);
    const sellerGoalOre = seller.individualGoal ? seller.individualGoal * 100 : undefined;

    const achieved = getAchievedMilestones(
      totalSalesOre,
      orderCount,
      sellerGoalOre,
      undefined,
      locale
    );
    const next = getNextMilestone(
      totalSalesOre,
      orderCount,
      sellerGoalOre,
      undefined,
      locale
    );

    const marginPercent = campaign?.marginPercent ?? 25;
    const estimatedEarningsOre = Math.round(totalSalesOre * (marginPercent / 100));

    return c.json({
      seller,
      team: team ? { id: team.id, name: team.name } : null,
      campaign: campaign
        ? {
            id: campaign.id,
            name: campaign.name,
            story: campaign.story,
            marginPercent: campaign.marginPercent,
          }
        : null,
      stats: {
        totalSalesOre,
        orderCount,
        estimatedEarningsOre,
      },
      grade: getSellerGrade(totalSalesOre, locale),
      milestones: {
        achieved: achieved.map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
        })),
        next: next
          ? { id: next.id, label: next.label, remaining: next.remaining }
          : null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        totalOre: o.totalOre,
        status: o.status,
        createdAt: o.createdAt,
        // Säljaren ska se att en egen registrerad order väntar på
        // lagledaren. Annars ser den ut som klar, och när avräkningen
        // landar lägre än väntat finns ingen förklaring i gränssnittet.
        isManual: o.isManual,
        verifiedAt: o.verifiedAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch seller dashboard");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});

/**
 * MASTERPLAN_02: order lagd av säljaren själv (manuell order).
 *
 * Säljaren tar emot kontant/Swish/kort vid dörren och registrerar
 * ordern i appen. Den attribueras till säljarens egen profil, markeras
 * `isManual=true` och `paymentMethod=DIRECT_TO_LEADER` (pengarna går via
 * laget, inte Klarna). Den räknas i topplistor om den ligger inom
 * kampanjens säljperiod, precis som online-ordrar.
 *
 * Body:
 *   items: [{ productId, qty }]   (obligatoriskt, qty 1–100)
 *   customerName?: string          (valfritt — "Kontantkund" om tomt)
 *   paymentMethod?: "swish" | "cash" | "card"  (default "cash")
 *   note?: string
 */
dashboard.post("/seller/orders", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotRegisterOrders") }, 403);
  }

  // Rå body behövs för idempotensnyckeln — ett dubbeltryck eller en retry
  // på mobilen ska inte bli två ordrar som båda hamnar i avräkningen.
  const rawBody = await c.req.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const headerKey = c.req.header("idempotency-key")?.trim() ?? "";
  const idempotencyKey = createHash("sha256")
    .update(`manual:${session.userId}:${headerKey}:${rawBody}`)
    .digest("hex")
    .slice(0, 120);

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return c.json({ error: uiError(locale, "atLeastOneItemRequired") }, 400);
  }
  for (const item of items) {
    if (
      !item?.productId ||
      typeof item.qty !== "number" ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 100
    ) {
      return c.json(
        { error: uiError(locale, "invalidQty") },
        400
      );
    }
  }

  const paymentRaw =
    typeof body?.paymentMethod === "string"
      ? body.paymentMethod.toLowerCase().trim()
      : "cash";
  const selectedPaymentMethod = ["swish", "cash", "card"].includes(paymentRaw)
    ? paymentRaw
    : "cash";
  const customerName =
    typeof body?.customerName === "string" && body.customerName.trim().length > 0
      ? body.customerName.trim().slice(0, 255)
      : "Kontantkund";
  const note =
    typeof body?.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 2000)
      : null;

  try {
    const [existingByKey] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existingByKey) {
      return c.json({
        ok: true,
        idempotent: true,
        order: {
          id: existingByKey.id,
          totalOre: existingByKey.totalOre,
          status: existingByKey.status,
          selectedPaymentMethod: existingByKey.selectedPaymentMethod,
          countsTowardStats: existingByKey.countsTowardStats,
          createdAt: existingByKey.createdAt,
        },
      });
    }

    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);
    if (!seller) return c.json({ error: uiError(locale, "noSellerProfile") }, 404);
    if (seller.status !== "ACTIVE") {
      return c.json({ error: uiError(locale, "sellerProfileInactive") }, 403);
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);
    if (!campaign || campaign.status !== "ACTIVE") {
      return c.json({ error: uiError(locale, "campaignInactive") }, 400);
    }

    // Samma periodlogik som publika checkout (Europe/Stockholm).
    const todayStr = stockholmDateIso();
    const withinPeriod =
      campaign.startDate <= todayStr && todayStr <= campaign.endDate;
    if (!withinPeriod && !campaign.allowSalesOutsidePeriod) {
      return c.json(
        { error: uiError(locale, "salesPeriodInactive") },
        400
      );
    }
    const countsTowardStats = withinPeriod;

    // Samma katalog och samma pris som den publika kassan använder.
    const productMap = await resolveCampaignCatalog(seller.campaignId);

    let totalOre = 0;
    const lines: Array<{ productId: string; qty: number; unitPriceOre: number }> =
      [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return c.json({ error: uiError(locale, "productNotFoundPrefix") + item.productId }, 400);
      }
      totalOre += product.effectivePriceOre * item.qty;
      lines.push({
        productId: product.id,
        qty: item.qty,
        unitPriceOre: product.effectivePriceOre,
      });
    }
    if (totalOre === 0) {
      return c.json({ error: uiError(locale, "cartEmpty") }, 400);
    }

    const [order] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(customerOrders)
        .values({
          orgId: team.orgId,
          campaignId: seller.campaignId,
          teamId: seller.teamId,
          sellerId: seller.id,
          customerName,
          // Manuella ordrar saknar kunddata; använd säljarens placeholder.
          customerEmail: "",
          deliveryType: "BULK",
          paymentMethod: "DIRECT_TO_LEADER",
          selectedPaymentMethod,
          // Säljaren säger att hen fått kontanter i handen. Vi tror på det i
          // statistiken, men ordern räknas inte in i någon utbetalning förrän
          // lagledare eller föreningsadmin bekräftat den (verifiedAt).
          status: "PAID",
          totalOre,
          shippingOre: 0,
          countsTowardStats,
          isManual: true,
          placedByUserId: session.userId,
          marginPercentAtSale: campaign.marginPercent,
          idempotencyKey,
          note,
        })
        .returning();
      for (const line of lines) {
        await tx.insert(customerOrderLines).values({
          orderId: created.id,
          productId: line.productId,
          qty: line.qty,
          unitPriceOre: line.unitPriceOre,
        });
      }
      return [created];
    });

    return c.json({
      ok: true,
      order: {
        id: order.id,
        totalOre: order.totalOre,
        status: order.status,
        selectedPaymentMethod: order.selectedPaymentMethod,
        countsTowardStats: order.countsTowardStats,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to create manual seller order");
    return c.json({ error: uiError(locale, "couldNotRegisterOrder") }, 500);
  }
});

/**
 * Single order detail for the logged-in seller's own order. Used by
 * the /min-shop/bestallningar order-detail dialog. Returns customer
 * contact info, shipping address, line items with product names, and
 * status/payment metadata.
 *
 * RBAC: the order must reference the seller row that belongs to the
 * caller. INTERNAL_ADMIN and the team's leader / association admin
 * can also view, to keep this endpoint useful for the same UX in
 * other portals later (currently only wired up for SELLER).
 */
dashboard.get("/seller/orders/:orderId", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);

    const [orderSeller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.id, order.sellerId))
      .limit(1);
    if (!orderSeller) {
      // Defensive: an order without a seller row should not exist —
      // treat as 404 rather than leak the order's internals.
      return c.json({ error: uiError(locale, "orderNotFound") }, 404);
    }

    const [orderTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, order.teamId))
      .limit(1);

    const isOwner = orderSeller.userId === session.userId;
    const isInternalAdmin = session.role === "INTERNAL_ADMIN";
    const isTeamLeader =
      session.role === "TEAM_LEADER" &&
      !!orderTeam &&
      orderTeam.leaderId === session.userId;
    const isAssocAdmin =
      session.role === "ASSOCIATION_ADMIN" &&
      session.orgId === order.orgId;

    if (!isOwner && !isInternalAdmin && !isTeamLeader && !isAssocAdmin) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    // Load order lines + product names in one query. We intentionally
    // don't ship product description/price-history fields — the dialog
    // only needs name, qty and the unit price captured at order time
    // (so the dialog still reflects what the customer was charged even
    // if the product price has since changed).
    const lines = await db
      .select({
        id: customerOrderLines.id,
        productId: customerOrderLines.productId,
        productName: products.name,
        productSku: products.sku,
        qty: customerOrderLines.qty,
        unitPriceOre: customerOrderLines.unitPriceOre,
      })
      .from(customerOrderLines)
      .leftJoin(products, eq(customerOrderLines.productId, products.id))
      .where(eq(customerOrderLines.orderId, order.id));

    return c.json({
      order: {
        id: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        selectedPaymentMethod: order.selectedPaymentMethod,
        isManual: order.isManual,
        deliveryType: order.deliveryType,
        totalOre: order.totalOre,
        shippingOre: order.shippingOre,
        klarnaOrderId: order.klarnaOrderId,
        note: order.note,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        cancelReason: order.cancelReason,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Säljaren ser att den egna ordern väntar på lagledaren, och
        // lagledaren får knappen. Bara den ena av dem får `canVerify`.
        verifiedAt: order.verifiedAt,
        canVerify:
          !!orderTeam &&
          canVerifyManualOrder(session, order, orderTeam),
        // Behörigheterna räknas ut här istället för i klienten. Dialogen
        // visas för fyra olika roller och skulle annars behöva känna till
        // reglerna själv — och då hamnar en knapp förr eller senare framför
        // någon som inte får trycka på den.
        canManageFulfillment: isInternalAdmin || isTeamLeader || isAssocAdmin,
        canCancel:
          isInternalAdmin ||
          isTeamLeader ||
          isAssocAdmin ||
          // Säljaren får rätta sin egen felregistrering fram till att
          // lagledaren bekräftat den.
          (isOwner &&
            order.isManual &&
            !order.verifiedAt &&
            order.placedByUserId === session.userId),
        customer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
        },
        shipping: {
          line1: order.shippingAddressLine1,
          line2: order.shippingAddressLine2,
          city: order.shippingCity,
          postalCode: order.shippingPostalCode,
        },
      },
      lines: lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        productName: localizedProductName(locale, {
          sku: l.productSku,
          fallback: l.productName ?? uiError(locale, "unknownProduct"),
        }),
        productSku: l.productSku ?? null,
        qty: l.qty,
        unitPriceOre: l.unitPriceOre,
        lineTotalOre: l.qty * l.unitPriceOre,
      })),
    });
  } catch (err) {
    log.error({ err, orderId }, "Failed to fetch seller order detail");
    return c.json({ error: uiError(locale, "couldNotFetchOrder") }, 500);
  }
});

/**
 * MASTERPLAN_02: leveransspårning för en enskild order.
 *
 * PATCH /v1/dashboard/orders/:orderId/fulfillment
 *   body: { status: "SHIPPED" | "DELIVERED" | "PAID" }
 *
 * Behörighet: lagledaren för orderns lag, föreningens admin (samma org)
 * eller intern admin. Sätter shipped_at/delivered_at när relevant.
 */
dashboard.patch("/orders/:orderId/fulfillment", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotChangeDelivery") }, 403);
  }

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  let body: { status?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);
  const status = body.status;
  if (status !== "SHIPPED" && status !== "DELIVERED" && status !== "PAID") {
    return c.json(
      { error: uiError(locale, "statusShippedDeliveredPaid") },
      400
    );
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);

    const [orderTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, order.teamId))
      .limit(1);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === order.orgId) ||
      (session.role === "TEAM_LEADER" &&
        !!orderTeam &&
        orderTeam.leaderId === session.userId);
    if (!hasAccess) return c.json({ error: uiError(locale, "permissionDenied") }, 403);

    // En avbokad eller återbetald order är stängd. Utan den här kontrollen
    // kunde "ångra leveransmarkering" (status: PAID) sätta tillbaka den till
    // betald från vilket läge som helst, och därmed återuppliva pengar som
    // redan lämnat systemet. Vägen tillbaka går via en ny order, inte via
    // leveransstatus.
    if (
      order.status === "CANCELLED" ||
      order.status === "REFUNDED" ||
      order.status === "FAILED"
    ) {
      return c.json(
        {
          error: uiError(locale, "orderCancelledOrRefundedLocked"),
        },
        400
      );
    }

    // Endast betalda/bekräftade ordrar kan markeras skickade/levererade.
    if (
      (status === "SHIPPED" || status === "DELIVERED") &&
      order.status !== "PAID" &&
      order.status !== "CONFIRMED" &&
      order.status !== "SHIPPED" &&
      order.status !== "DELIVERED"
    ) {
      return c.json(
        { error: uiError(locale, "onlyPaidOrdersShipDeliver") },
        400
      );
    }

    const patch: {
      status: "SHIPPED" | "DELIVERED" | "PAID";
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      updatedAt: Date;
    } = { status, updatedAt: new Date() };
    if (status === "SHIPPED") {
      patch.shippedAt = order.shippedAt ?? new Date();
    } else if (status === "DELIVERED") {
      patch.shippedAt = order.shippedAt ?? new Date();
      patch.deliveredAt = new Date();
    } else if (status === "PAID") {
      // Ångra leverans-flaggning.
      patch.shippedAt = null;
      patch.deliveredAt = null;
    }

    const [updated] = await db
      .update(customerOrders)
      .set(patch)
      .where(eq(customerOrders.id, orderId))
      .returning();

    return c.json({
      ok: true,
      order: {
        id: updated.id,
        status: updated.status,
        shippedAt: updated.shippedAt,
        deliveredAt: updated.deliveredAt,
      },
    });
  } catch (err) {
    log.error({ err, orderId }, "Failed to update order fulfillment");
    return c.json({ error: uiError(locale, "couldNotUpdateDelivery") }, 500);
  }
});

/**
 * Bekräfta (eller ta tillbaka bekräftelsen på) en manuell order.
 *
 * En manuell order är säljarens egen registrering av "jag fick 300 kr i
 * handen". Den syns i statistiken direkt, men räknas inte in i någon
 * utbetalning förrän lagledaren eller föreningsadmin bekräftat att pengarna
 * finns. Säljaren kan aldrig bekräfta sin egen order.
 *
 *   POST /v1/dashboard/orders/:orderId/verify   { verified: boolean }
 */
dashboard.post("/orders/:orderId/verify", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotConfirmOrders") }, 403);
  }
  if (
    session.role !== "TEAM_LEADER" &&
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  let body: { verified?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);
  const verified = body.verified !== false;

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);
    if (!order.isManual) {
      return c.json(
        { error: uiError(locale, "onlyManualOrdersNeedConfirm") },
        400
      );
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return c.json(
        { error: uiError(locale, "orderCancelledCannotConfirm") },
        400
      );
    }

    const [orderTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, order.teamId))
      .limit(1);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === order.orgId) ||
      (session.role === "TEAM_LEADER" &&
        !!orderTeam &&
        orderTeam.leaderId === session.userId);
    if (!hasAccess) return c.json({ error: uiError(locale, "permissionDenied") }, 403);

    // Den som lade ordern får inte godkänna den. Annars är kontrollen
    // meningslös för precis det scenario den finns till för.
    if (order.placedByUserId && order.placedByUserId === session.userId) {
      return c.json(
        { error: uiError(locale, "cannotConfirmOwnOrder") },
        403
      );
    }

    const [updated] = await db
      .update(customerOrders)
      .set({
        verifiedAt: verified ? (order.verifiedAt ?? new Date()) : null,
        verifiedByUserId: verified ? session.userId : null,
        updatedAt: new Date(),
      })
      .where(eq(customerOrders.id, orderId))
      .returning();

    void auditLog({
      userId: session.userId,
      action: verified
        ? "order.manual.verified"
        : "order.manual.verification_revoked",
      entityType: "customer_order",
      entityId: orderId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        totalOre: order.totalOre,
        teamId: order.teamId,
      },
    });

    return c.json({
      ok: true,
      order: {
        id: updated.id,
        verifiedAt: updated.verifiedAt,
        verifiedByUserId: updated.verifiedByUserId,
      },
    });
  } catch (err) {
    log.error({ err, orderId }, "Failed to verify manual order");
    return c.json({ error: uiError(locale, "orderConfirmFailed") }, 500);
  }
});

/**
 * Avboka eller återbetala en kundorder.
 *
 *   POST /v1/dashboard/orders/:orderId/cancel
 *   body: { status: "CANCELLED" | "REFUNDED", reason: string, force?: boolean }
 *
 * CANCELLED och REFUNDED har funnits i statusenumen sedan första
 * migrationen men sattes aldrig av någon kodväg. En felregistrerad manuell
 * order gick alltså bara att rätta direkt i databasen, och en order som
 * kunden fått pengarna tillbaka för låg kvar som intäkt i lagets förtjänst.
 *
 * Skillnaden mellan de två statusarna är om pengar hunnit röra sig:
 * CANCELLED betyder att ordern aldrig blev en betalning, REFUNDED att den
 * blev det och gick tillbaka. Båda faller ur REVENUE_ORDER_STATUSES och
 * därmed ur avräkningen.
 */
dashboard.post("/orders/:orderId/cancel", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotCancelOrders") }, 403);
  }

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  let body: { status?: string; reason?: string; force?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const target = body.status;
  if (target !== "CANCELLED" && target !== "REFUNDED") {
    return c.json(
      { error: uiError(locale, "statusCancelledOrRefunded") },
      400
    );
  }

  // Skälet är inte formalia. Utan det går det inte att i efterhand skilja
  // "kunden ångrade sig" från "säljaren skrev fel belopp", och det är just
  // den skillnaden som avgör om försäljningen ska räknas om eller inte.
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3) {
    return c.json({ error: uiError(locale, "enterReasonMin3") }, 400);
  }
  if (reason.length > 500) {
    return c.json({ error: uiError(locale, "reasonMax500") }, 400);
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);

    // Redan avbokad — svara med nuvarande läge istället för att fela, så
    // att en dubbelklick inte ser ut som ett fel för användaren.
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return c.json({
        ok: true,
        alreadyClosed: true,
        order: {
          id: order.id,
          status: order.status,
          cancelledAt: order.cancelledAt,
          cancelReason: order.cancelReason,
        },
      });
    }

    const [orderTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, order.teamId))
      .limit(1);

    const isLeaderOrAbove =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === order.orgId) ||
      (session.role === "TEAM_LEADER" &&
        !!orderTeam &&
        orderTeam.leaderId === session.userId);

    // En säljare får rätta sin egen felregistrering så länge lagledaren inte
    // hunnit bekräfta den. Efter bekräftelse är den en del av underlaget för
    // utbetalning och då krävs lagledare eller uppåt — annars kunde en
    // säljare i efterhand plocka bort spår av en order som redan räknats.
    const isOwnUnverifiedManual =
      order.isManual &&
      !order.verifiedAt &&
      !!order.placedByUserId &&
      order.placedByUserId === session.userId;

    if (!isLeaderOrAbove && !isOwnUnverifiedManual) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    // Kundens pengar ligger hos Klarna. Att bara markera ordern som avbokad
    // hos oss lämnar dem där, så den vägen måste gå via återbetalning.
    if (
      target === "CANCELLED" &&
      order.paymentMethod === "KLARNA" &&
      countsAsRevenue(order.status)
    ) {
      return c.json(
        {
          error: uiError(locale, "orderPaidUseRefund"),
        },
        400
      );
    }

    // Pengar som redan lämnat oss kan inte tas tillbaka genom en
    // statusändring. Avräkningen skyddar fakturerade och utbetalda payouts
    // mot omräkning, vilket betyder att en avbokning här skulle göra
    // underlaget och det utbetalda beloppet oense. Kräv ett aktivt val.
    const [lockedPayout] = await db
      .select({ id: payouts.id, status: payouts.status })
      .from(payouts)
      .where(
        and(
          eq(payouts.campaignId, order.campaignId),
          eq(payouts.teamId, order.teamId),
          inArray(payouts.status, ["INVOICED", "PAID"])
        )
      )
      .limit(1);

    const countedInPayout = countsAsRevenue(order.status) && !!lockedPayout;
    if (countedInPayout && body.force !== true) {
      return c.json(
        {
          error: uiError(locale, "teamPayoutAlreadyInvoicedCancel"),
          requiresForce: true,
          payoutStatus: lockedPayout.status,
        },
        409
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(customerOrders)
      .set({
        status: target,
        cancelledAt: now,
        cancelledByUserId: session.userId,
        cancelReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(customerOrders.id, orderId),
          // Optimistisk låsning: någon annan kan ha avbokat under tiden.
          eq(customerOrders.status, order.status)
        )
      )
      .returning();

    if (!updated) {
      return c.json(
        { error: uiError(locale, "orderChangedByOther") },
        409
      );
    }

    void auditLog({
      userId: session.userId,
      action: target === "REFUNDED" ? "order.refunded" : "order.cancelled",
      entityType: "customer_order",
      entityId: orderId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        previousStatus: order.status,
        totalOre: order.totalOre,
        teamId: order.teamId,
        campaignId: order.campaignId,
        isManual: order.isManual,
        paymentMethod: order.paymentMethod,
        reason,
        countedInLockedPayout: countedInPayout,
        forced: countedInPayout && body.force === true,
      },
    });

    return c.json({
      ok: true,
      order: {
        id: updated.id,
        status: updated.status,
        cancelledAt: updated.cancelledAt,
        cancelReason: updated.cancelReason,
      },
      // Klarna-återbetalningen kan vi inte utföra själva ännu, så säg det
      // rakt ut istället för att låta användaren tro att pengarna är på väg.
      manualStepRequired:
        target === "REFUNDED" && order.paymentMethod === "KLARNA"
          ? uiError(locale, "klarnaRefundManualStep")
          : null,
    });
  } catch (err) {
    log.error({ err, orderId }, "Failed to cancel order");
    return c.json({ error: uiError(locale, "couldNotCancelOrder") }, 500);
  }
});

/**
 * MASTERPLAN_02: samlad leverans till klubben.
 *
 * POST /v1/dashboard/campaign/:campaignId/ship-bulk
 *   Markerar alla betalda BULK-ordrar i kampanjen som SHIPPED på en gång
 *   (när lådan skickas till föreningen). Endast föreningens admin eller
 *   intern admin.
 */
dashboard.post("/campaign/:campaignId/ship-bulk", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotChangeDelivery") }, 403);
  }
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  const campaignId = c.req.param("campaignId");
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
    return c.json({ error: uiError(locale, "invalidCampaignId") }, 400);
  }

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return c.json({ error: uiError(locale, "campaignNotFoundThe") }, 404);
    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    const now = new Date();
    const updated = await db
      .update(customerOrders)
      .set({ status: "SHIPPED", shippedAt: now, updatedAt: now })
      .where(
        and(
          eq(customerOrders.campaignId, campaignId),
          eq(customerOrders.status, "PAID"),
          // Endast samlade BULK-ordrar skickas till klubben på en gång.
          // Hemleveranser (DIRECT) skickas individuellt och får inte
          // flaggas som skickade av bulk-knappen.
          eq(customerOrders.deliveryType, "BULK")
        )
      )
      .returning({ id: customerOrders.id });

    return c.json({ ok: true, shipped: updated.length });
  } catch (err) {
    log.error({ err, campaignId }, "Bulk ship failed");
    return c.json({ error: uiError(locale, "couldNotMarkDelivery") }, 500);
  }
});

function todayIso(): string {
  return stockholmDateIso();
}

function clampPeriodStart(campaignStart: string | null | undefined): string {
  const windowStart = statsSince().toISOString().slice(0, 10);
  if (campaignStart && campaignStart > windowStart) return campaignStart;
  return windowStart;
}

/**
 * Statistik för FÖRENINGEN — daglig trend, betalmetoder, veckodagar,
 * lag-topplista och mål-progress. Allt org-scopat och PAID-filtrerat.
 */
dashboard.get("/association/stats", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (!session.orgId) return c.json({ error: uiError(locale, "noOrganisation") }, 403);
  if (session.role !== "ASSOCIATION_ADMIN" && session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  const orgId = session.orgId;
  const scope = and(eq(customerOrders.orgId, orgId));

  try {
    const [daily, payments, weekday] = await Promise.all([
      dailySeries(scope),
      paymentSeries(scope),
      weekdaySeries(scope, locale),
    ]);

    const byTeam = await db
      .select({
        id: teams.id,
        name: teams.name,
        salesOre: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .innerJoin(teams, eq(customerOrders.teamId, teams.id))
      .where(and(eq(customerOrders.orgId, orgId), PAID_IN_STATS))
      .groupBy(teams.id, teams.name)
      .orderBy(sql`COALESCE(SUM(${customerOrders.totalOre}), 0) DESC`);

    // Mål-gaugen visar kronor, så summera bara AMOUNT-mål (× 100 = öre).
    // PACKAGES-mål (antal paket) kan inte summeras in i en kr-gauge —
    // tidigare gav det t.ex. 500 paket → "50 000 kr" och fel progress-%.
    const goalRows = await db
      .select({ g: sql<number>`COALESCE(SUM(${teamGoals.goalValue}), 0)` })
      .from(teamGoals)
      .innerJoin(teams, eq(teamGoals.teamId, teams.id))
      .where(and(eq(teams.orgId, orgId), eq(teamGoals.goalType, "AMOUNT")));
    const goalOre = Number(goalRows[0]?.g ?? 0) * 100;

    const totalsRow = await db
      .select({
        sales: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(and(eq(customerOrders.orgId, orgId), PAID_IN_STATS));

    const campRows = await db
      .select({ start: sql<string | null>`MIN(${campaigns.startDate})` })
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));

    const salesOre = Number(totalsRow[0]?.sales ?? 0);
    const orders = Number(totalsRow[0]?.orders ?? 0);
    return c.json({
      scope: "association",
      daily,
      payments,
      weekday,
      breakdown: byTeam.map((t) => ({
        id: t.id,
        name: t.name,
        salesOre: Number(t.salesOre),
        orders: Number(t.orders),
      })),
      goalOre,
      currentOre: salesOre,
      totals: {
        salesOre,
        orders,
        avgOrderOre: orders > 0 ? Math.round(salesOre / orders) : 0,
      },
      periodStart: clampPeriodStart(campRows[0]?.start ?? null),
      periodEnd: todayIso(),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch association stats");
    return c.json({ error: uiError(locale, "couldNotFetchStats") }, 500);
  }
});

/**
 * Statistik för LAGET — daglig trend, betalmetoder, veckodagar,
 * säljar-topplista och mål-progress (kampanjmål).
 */
dashboard.get("/team/:teamId/stats", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  const teamId = c.req.param("teamId");

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);
    if (!hasAccess) return c.json({ error: uiError(locale, "permissionDenied") }, 403);

    const scope = and(eq(customerOrders.teamId, teamId));
    const [daily, payments, weekday] = await Promise.all([
      dailySeries(scope),
      paymentSeries(scope),
      weekdaySeries(scope, locale),
    ]);

    const bySeller = await db
      .select({
        id: sellers.id,
        name: sellers.displayName,
        salesOre: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .innerJoin(sellers, eq(customerOrders.sellerId, sellers.id))
      .where(and(eq(customerOrders.teamId, teamId), PAID_IN_STATS))
      .groupBy(sellers.id, sellers.displayName)
      .orderBy(sql`COALESCE(SUM(${customerOrders.totalOre}), 0) DESC`);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, team.campaignId))
      .limit(1);
    let goalOre = 0;
    if (campaign?.goalType === "AMOUNT" && campaign?.goalValue) {
      goalOre = campaign.goalValue * 100;
    } else {
      const tg = await db
        .select({ g: sql<number>`COALESCE(SUM(${teamGoals.goalValue}), 0)` })
        .from(teamGoals)
        .where(eq(teamGoals.teamId, teamId));
      goalOre = Number(tg[0]?.g ?? 0) * 100;
    }

    const totalsRow = await db
      .select({
        sales: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(and(eq(customerOrders.teamId, teamId), PAID_IN_STATS));

    const salesOre = Number(totalsRow[0]?.sales ?? 0);
    const orders = Number(totalsRow[0]?.orders ?? 0);
    return c.json({
      scope: "team",
      daily,
      payments,
      weekday,
      breakdown: bySeller.map((s) => ({
        id: s.id,
        name: s.name,
        salesOre: Number(s.salesOre),
        orders: Number(s.orders),
      })),
      goalOre,
      currentOre: salesOre,
      totals: {
        salesOre,
        orders,
        avgOrderOre: orders > 0 ? Math.round(salesOre / orders) : 0,
      },
      periodStart: clampPeriodStart(campaign?.startDate ?? null),
      periodEnd: todayIso(),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch team stats");
    return c.json({ error: uiError(locale, "couldNotFetchStats") }, 500);
  }
});

/**
 * Statistik för SÄLJAREN — daglig trend, betalmetoder, veckodagar,
 * produkt-fördelning och mål-progress (individuellt mål).
 */
dashboard.get("/seller/stats", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);
    if (!seller) return c.json({ error: uiError(locale, "noSellerProfile") }, 404);

    const scope = and(eq(customerOrders.sellerId, seller.id));
    const [daily, payments, weekday] = await Promise.all([
      dailySeries(scope),
      paymentSeries(scope),
      weekdaySeries(scope, locale),
    ]);

    const byProduct = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        sku: products.sku,
        salesOre: sql<number>`COALESCE(SUM(${customerOrderLines.qty} * ${customerOrderLines.unitPriceOre}), 0)`,
        units: sql<number>`COALESCE(SUM(${customerOrderLines.qty}), 0)`,
      })
      .from(customerOrderLines)
      .innerJoin(
        customerOrders,
        eq(customerOrderLines.orderId, customerOrders.id)
      )
      .innerJoin(products, eq(customerOrderLines.productId, products.id))
      .where(and(eq(customerOrders.sellerId, seller.id), PAID_IN_STATS))
      .groupBy(products.id, products.name, products.slug, products.sku)
      .orderBy(
        sql`COALESCE(SUM(${customerOrderLines.qty} * ${customerOrderLines.unitPriceOre}), 0) DESC`
      );

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    const totalsRow = await db
      .select({
        sales: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .where(and(eq(customerOrders.sellerId, seller.id), PAID_IN_STATS));

    const salesOre = Number(totalsRow[0]?.sales ?? 0);
    const orders = Number(totalsRow[0]?.orders ?? 0);
    const goalOre = seller.individualGoal ? seller.individualGoal * 100 : 0;
    return c.json({
      scope: "seller",
      daily,
      payments,
      weekday,
      breakdown: byProduct.map((p) => ({
        id: p.id,
        name: localizedProductName(locale, {
          slug: p.slug,
          sku: p.sku,
          fallback: p.name,
        }),
        salesOre: Number(p.salesOre),
        units: Number(p.units),
      })),
      goalOre,
      currentOre: salesOre,
      totals: {
        salesOre,
        orders,
        avgOrderOre: orders > 0 ? Math.round(salesOre / orders) : 0,
      },
      periodStart: clampPeriodStart(campaign?.startDate ?? null),
      periodEnd: todayIso(),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch seller stats");
    return c.json({ error: uiError(locale, "couldNotFetchStats") }, 500);
  }
});
