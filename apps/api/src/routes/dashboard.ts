import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
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
} from "@roots/db/schema";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import type { SessionData } from "../lib/session";
import { getAchievedMilestones, getNextMilestone, getSellerGrade } from "../lib/milestones";
import { getEmailSender } from "../lib/email";
import { welcomeEmail } from "../lib/email/templates";
import { childLogger } from "../lib/logger";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

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
        const sellerSalesOre = Number(sales?.total || 0);
        return {
          id: s.id,
          displayName: s.displayName,
          shopSlug: s.shopSlug,
          totalSalesOre: sellerSalesOre,
          orderCount: Number(sales?.count || 0),
          individualGoal: s.individualGoal,
          grade: getSellerGrade(sellerSalesOre),
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

// Sprint E10: update a seller's individual goal. Access rules mirror
// the team-level RBAC used in `/team/:teamId/sellers` above — only the
// team's own leader, the team's association admin, or an internal admin
// can change the goal. We only allow `individualGoal` (in kronor) so a
// bug in the UI can't accidentally PATCH e.g. role or shopSlug.
dashboard.patch("/sellers/:sellerId", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const sellerId = c.req.param("sellerId");
  if (!/^[0-9a-f-]{36}$/i.test(sellerId)) {
    return c.json({ error: "Ogiltigt säljar-ID." }, 400);
  }

  let body: { individualGoal?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const goalRaw = body.individualGoal;
  if (
    goalRaw === undefined ||
    !Number.isFinite(goalRaw) ||
    !Number.isInteger(goalRaw) ||
    goalRaw < 0 ||
    goalRaw > 10_000_000
  ) {
    return c.json(
      { error: "individualGoal måste vara ett heltal mellan 0 och 10 000 000 kr." },
      400
    );
  }

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.id, sellerId))
      .limit(1);
    if (!seller) return c.json({ error: "Säljare hittades inte" }, 404);

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const [updated] = await db
      .update(sellers)
      .set({ individualGoal: goalRaw, updatedAt: new Date() })
      .where(eq(sellers.id, sellerId))
      .returning();

    return c.json({
      id: updated.id,
      individualGoal: updated.individualGoal,
    });
  } catch (err) {
    log.error({ err }, "Failed to update seller goal");
    return c.json({ error: "Kunde inte uppdatera mål" }, 500);
  }
});

dashboard.post("/team/:teamId/sellers", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const teamId = c.req.param("teamId");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const { displayName, email, password } = body;
  if (!displayName || !email || !password) {
    return c.json({ error: "Namn, e-post och lösenord krävs." }, 400);
  }

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
        ...welcomeEmail(displayName, "SELLER"),
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
        grade: getSellerGrade(0),
      },
    });
  } catch (err: any) {
    log.error({ err }, "Failed to create seller inline");
    return c.json({ error: "Kunde inte skapa säljare." }, 500);
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
      grade: getSellerGrade(totalSalesOre),
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
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: "Ogiltigt order-ID." }, 400);
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: "Order hittades inte" }, 404);

    const [orderSeller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.id, order.sellerId))
      .limit(1);
    if (!orderSeller) {
      // Defensive: an order without a seller row should not exist —
      // treat as 404 rather than leak the order's internals.
      return c.json({ error: "Order hittades inte" }, 404);
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
      return c.json({ error: "Behörighet saknas" }, 403);
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
        deliveryType: order.deliveryType,
        totalOre: order.totalOre,
        shippingOre: order.shippingOre,
        klarnaOrderId: order.klarnaOrderId,
        note: order.note,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
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
        productName: l.productName ?? "Okänd produkt",
        productSku: l.productSku ?? null,
        qty: l.qty,
        unitPriceOre: l.unitPriceOre,
        lineTotalOre: l.qty * l.unitPriceOre,
      })),
    });
  } catch (err) {
    log.error({ err, orderId }, "Failed to fetch seller order detail");
    return c.json({ error: "Kunde inte hämta order" }, 500);
  }
});
