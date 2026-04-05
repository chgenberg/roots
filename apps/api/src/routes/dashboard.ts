import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  campaigns,
  teams,
  sellers,
  customerOrders,
  teamGoals,
} from "@roots/db/schema";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import type { SessionData } from "../lib/session";
import { getAchievedMilestones, getNextMilestone } from "../lib/milestones";
import { childLogger } from "../lib/logger";

const log = childLogger("dashboard");

export const dashboard = new Hono();

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

dashboard.get("/association", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!session.orgId) return c.json({ error: "Ingen organisation" }, 403);

  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
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
          eq(customerOrders.status, "PAID")
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
          memberCount: t.memberCount,
          leaderId: t.leaderId,
          totalSalesOre: Number(sales?.total || 0),
          orderCount: Number(sales?.count || 0),
          goalValue: goal?.team_goals.goalValue || 0,
          inviteToken: t.inviteToken,
        };
      }),
      sellers: sellerList,
      stats: { totalSalesOre: totalSales, totalOrders },
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch association dashboard");
    return c.json({ error: "Kunde inte hämta data" }, 500);
  }
});

dashboard.get("/my-team", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.leaderId, session.userId))
      .limit(1);

    if (!team) return c.json({ error: "Inget lag hittades" }, 404);

    return c.json({ teamId: team.id });
  } catch (err) {
    log.error({ err }, "Failed to fetch my-team");
    return c.json({ error: "Kunde inte hämta data" }, 500);
  }
});

dashboard.get("/team/:teamId", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const teamId = c.req.param("teamId");

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return c.json({ error: "Lag hittades inte" }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: "Behörighet saknas" }, 403);
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
          eq(customerOrders.status, "PAID")
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

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, team.campaignId))
      .limit(1);

    const marginPercent = campaign?.marginPercent ?? 25;
    const teamEarningsOre = Math.round(totalSales * (marginPercent / 100));
    const goalOre = campaign?.goalType === "AMOUNT" && campaign?.goalValue ? campaign.goalValue * 100 : undefined;
    const goalPackages = campaign?.goalType === "PACKAGES" && campaign?.goalValue ? campaign.goalValue : undefined;
    const achieved = getAchievedMilestones(totalSales, totalOrderCount, goalOre, goalPackages);
    const next = getNextMilestone(totalSales, totalOrderCount, goalOre, goalPackages);

    return c.json({
      team,
      campaign: campaign
        ? { ...campaign, marginPercent: campaign.marginPercent }
        : null,
      sellers: sellerList.map((s) => {
        const sales = salesBySeller.find((ss) => ss.sellerId === s.id);
        return {
          id: s.id,
          displayName: s.displayName,
          shopSlug: s.shopSlug,
          totalSalesOre: Number(sales?.total || 0),
          orderCount: Number(sales?.count || 0),
          individualGoal: s.individualGoal,
        };
      }),
      orders: orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        totalOre: o.totalOre,
        status: o.status,
        paymentMethod: o.paymentMethod,
        deliveryType: o.deliveryType,
        sellerId: o.sellerId,
        createdAt: o.createdAt,
      })),
      stats: {
        totalSalesOre: totalSales,
        totalOrders: totalOrderCount,
        teamEarningsOre,
        marginPercent,
      },
      milestones: {
        achieved: achieved.map((m) => ({ id: m.id, label: m.label, description: m.description })),
        next: next ? { label: next.label, remaining: next.remaining } : null,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch team dashboard");
    return c.json({ error: "Kunde inte hämta data" }, 500);
  }
});

dashboard.get("/seller", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);

    if (!seller) return c.json({ error: "Ingen säljar-profil" }, 404);

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
          eq(customerOrders.status, "PAID")
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

    const achieved = getAchievedMilestones(totalSalesOre, orderCount, sellerGoalOre);
    const next = getNextMilestone(totalSalesOre, orderCount, sellerGoalOre);

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
      milestones: {
        achieved: achieved.map((m) => ({ id: m.id, label: m.label, description: m.description })),
        next: next ? { label: next.label, remaining: next.remaining } : null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        totalOre: o.totalOre,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch seller dashboard");
    return c.json({ error: "Kunde inte hämta data" }, 500);
  }
});
