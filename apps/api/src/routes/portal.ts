import { Hono } from "hono";
import { eq, sql, desc, and, count as drizzleCount } from "drizzle-orm";
import { db } from "@roots/db";
import {
  users,
  organizations,
  orders,
  orderLines,
  products,
  quotes,
  quoteLines,
} from "@roots/db/schema";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import type { SessionData } from "../lib/session";
import { childLogger } from "../lib/logger";
import type {
  DashboardResponse,
  StatisticsResponse,
  PipelineResponse,
  IncomeResponse,
  PortalRole,
} from "@roots/contracts";

const log = childLogger("portal");

export const portal = new Hono();

// ── Role / tenancy guards ──────────────────────────────────────────────
// Connection-audit P0 #1: prevent CLUB/fundraising sessions from falling
// through into admin aggregates that ignore orgId scoping. Fundraising
// roles (ASSOCIATION_ADMIN/TEAM_LEADER/SELLER) live on /forening, /lag,
// /min-shop — they must never hit /portal/*.
function isPortalRole(role: string): role is PortalRole {
  return (
    role === "CLUB_ADMIN" ||
    role === "CLUB_MEMBER" ||
    role === "SALES_REP" ||
    role === "SALES_ADMIN" ||
    role === "INTERNAL_ADMIN"
  );
}

function formatSek(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

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

// ── Dashboard KPIs (role-based) ─────────────────────────────

portal.get("/dashboard", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const role = session.role;
  if (!isPortalRole(role)) {
    // Fundraising roles (ASSOCIATION_ADMIN/TEAM_LEADER/SELLER) use the
    // /forening, /lag and /min-shop surfaces — they must not see portal
    // dashboards (which would leak cross-tenant aggregates).
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") {
      if (!session.orgId) {
        return c.json({ error: "Klubbkontext saknas" }, 400);
      }
      const orgId = session.orgId;

      const memberCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.orgId, orgId));

      const orderCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.orgId, orgId));

      const revenueResult = await db
        .select({
          total: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
        })
        .from(orders)
        .where(
          and(eq(orders.orgId, orgId), eq(orders.invoiceStatus, "PAID"))
        );

      const membersNum = Number(memberCount[0]?.count || 0);
      const ordersNum = Number(orderCount[0]?.count || 0);
      const revenueOre = Number(revenueResult[0]?.total || 0);
      const isDemo = membersNum === 0 && ordersNum === 0 && revenueOre === 0;

      const payload: DashboardResponse = {
        role,
        isDemo,
        stats: {
          members: membersNum,
          orders: ordersNum,
          revenueOre,
          revenue: formatSek(revenueOre),
          nextDelivery: null,
        },
      };
      return c.json(payload);
    }

    if (role === "SALES_REP") {
      // Scope sales-rep dashboard to the rep's own pipeline. They still
      // see the global club count (read-only catalog), but quote counts
      // and pipeline value reflect only quotes they own.
      const clubCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizations)
        .where(eq(organizations.type, "club"));

      const quoteCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotes)
        .where(eq(quotes.salesRepId, session.userId));

      const closedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotes)
        .where(
          and(
            eq(quotes.salesRepId, session.userId),
            eq(quotes.status, "ACCEPTED")
          )
        );

      const pipelineValue = await db
        .select({
          total: sql<number>`coalesce(sum(${quotes.totalOre}), 0)`,
        })
        .from(quotes)
        .where(
          and(
            eq(quotes.salesRepId, session.userId),
            eq(quotes.status, "SENT")
          )
        );

      const clubsNum = Number(clubCount[0]?.count || 0);
      const quotesNum = Number(quoteCount[0]?.count || 0);
      const closedNum = Number(closedCount[0]?.count || 0);
      const pipelineOre = Number(pipelineValue[0]?.total || 0);
      const isDemo =
        clubsNum === 0 && quotesNum === 0 && closedNum === 0 && pipelineOre === 0;

      const payload: DashboardResponse = {
        role,
        isDemo,
        stats: {
          clubs: clubsNum,
          quotesOut: quotesNum,
          closedThisMonth: closedNum,
          pipelineValueOre: pipelineOre,
          activeClubs: clubsNum,
          openQuotes: quotesNum,
          pipelineValue: formatSek(pipelineOre),
        },
      };
      return c.json(payload);
    }

    if (role === "SALES_ADMIN") {
      // Sales managers see the global sales pipeline.
      const clubCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizations)
        .where(eq(organizations.type, "club"));

      const quoteCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotes);

      const closedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotes)
        .where(eq(quotes.status, "ACCEPTED"));

      const pipelineValue = await db
        .select({
          total: sql<number>`coalesce(sum(${quotes.totalOre}), 0)`,
        })
        .from(quotes)
        .where(eq(quotes.status, "SENT"));

      const clubsNum = Number(clubCount[0]?.count || 0);
      const quotesNum = Number(quoteCount[0]?.count || 0);
      const closedNum = Number(closedCount[0]?.count || 0);
      const pipelineOre = Number(pipelineValue[0]?.total || 0);
      const isDemo =
        clubsNum === 0 && quotesNum === 0 && closedNum === 0 && pipelineOre === 0;

      const payload: DashboardResponse = {
        role,
        isDemo,
        stats: {
          clubs: clubsNum,
          quotesOut: quotesNum,
          closedThisMonth: closedNum,
          pipelineValueOre: pipelineOre,
          activeClubs: clubsNum,
          openQuotes: quotesNum,
          pipelineValue: formatSek(pipelineOre),
        },
      };
      return c.json(payload);
    }

    // INTERNAL_ADMIN — explicit guard prevents fall-through from any future
    // role that may slip past `isPortalRole`.
    if (role !== "INTERNAL_ADMIN") {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const totalOrders = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders);
    const totalClubs = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations);
    const mrrResult = await db
      .select({
        total: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
      })
      .from(orders)
      .where(eq(orders.invoiceStatus, "PAID"));

    const totalOrdersNum = Number(totalOrders[0]?.count || 0);
    const totalClubsNum = Number(totalClubs[0]?.count || 0);
    const mrrOre = Number(mrrResult[0]?.total || 0);
    const isDemo = totalOrdersNum === 0 && totalClubsNum === 0 && mrrOre === 0;

    const adminPayload: DashboardResponse = {
      role,
      isDemo,
      stats: {
        totalOrders: totalOrdersNum,
        totalClubs: totalClubsNum,
        mrrOre,
        mrr: formatSek(mrrOre),
        activeClubs: totalClubsNum,
        hairConversion: null,
      },
    };
    return c.json(adminPayload);
  } catch (err) {
    log.error({ err }, "Failed to fetch dashboard");
    return c.json({ error: "Kunde inte hämta data" }, 500);
  }
});

// ── Products ─────────────────────────────────────────────────

portal.get("/products", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const productList = await db.select().from(products).orderBy(products.name);
    return c.json({ products: productList });
  } catch (err) {
    log.error({ err }, "Failed to fetch products");
    return c.json({ error: "Kunde inte hämta produkter" }, 500);
  }
});

// ── Orders ───────────────────────────────────────────────────

type OrderRow = typeof orders.$inferSelect;

portal.get("/orders", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    let orderList: OrderRow[];
    if (
      session.role === "INTERNAL_ADMIN" ||
      session.role === "SALES_ADMIN"
    ) {
      orderList = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(100);
    } else if (session.orgId) {
      orderList = await db
        .select()
        .from(orders)
        .where(eq(orders.orgId, session.orgId))
        .orderBy(desc(orders.createdAt))
        .limit(100);
    } else {
      orderList = [];
    }

    return c.json({ orders: orderList });
  } catch (err) {
    log.error({ err }, "Failed to fetch orders");
    return c.json({ error: "Kunde inte hämta beställningar" }, 500);
  }
});

portal.post("/orders", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // The `orders` table requires both org_id and user_id (NOT NULL FKs). A
  // session without an org would create an orphan row that violates the
  // schema — fail fast with a 400 instead of letting the DB throw 500.
  // (Guest checkout has its own dedicated route — not this portal endpoint.)
  if (!session.orgId) {
    return c.json(
      { error: "Beställning kräver klubbkontext" },
      400
    );
  }

  try {
    const body = await c.req.json<{
      items: { productId: string; qty: number }[];
    }>();

    if (!body.items || body.items.length === 0) {
      return c.json({ error: "Inga produkter valda" }, 400);
    }

    const productIds = body.items.map((i) => i.productId);
    const productList = await db
      .select()
      .from(products)
      .where(sql`${products.id} = ANY(${productIds})`);

    let totalOre = 0;
    const lines: { productId: string; qty: number; unitPriceOre: number }[] =
      [];
    for (const item of body.items) {
      const p = productList.find((p) => p.id === item.productId);
      if (!p) continue;
      const unitPrice = p.priceOre ?? 0;
      totalOre += unitPrice * item.qty;
      lines.push({
        productId: item.productId,
        qty: item.qty,
        unitPriceOre: unitPrice,
      });
    }

    // Connection-audit P0 #6: wrap header + lines in a single transaction
    // so we never persist an order header without its lines (which would
    // leave totals correct on the parent but no item-level audit trail).
    const order = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orgId: session.orgId!,
          userId: session.userId,
          status: "PENDING",
          totalOre,
        })
        .returning();

      if (lines.length > 0) {
        await tx.insert(orderLines).values(
          lines.map((l) => ({
            orderId: newOrder.id,
            productId: l.productId,
            qty: l.qty,
            unitPriceOre: l.unitPriceOre,
          }))
        );
      }

      return newOrder;
    });

    return c.json({ ok: true, order });
  } catch (err) {
    log.error({ err }, "Failed to create order");
    return c.json({ error: "Kunde inte skapa beställning" }, 500);
  }
});

// ── Clubs ────────────────────────────────────────────────────

portal.get("/clubs", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // /clubs is a discovery surface for sales reps and platform admins.
  // CLUB roles already see their own org via /dashboard and /members,
  // so they don't need (and shouldn't get) a list of every club.
  if (
    session.role !== "SALES_REP" &&
    session.role !== "SALES_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const q = c.req.query("q") || "";

  try {
    let orgList;
    if (q.length >= 2) {
      const sanitized = q.replace(/[%_]/g, "");
      orgList = await db
        .select()
        .from(organizations)
        .where(sql`${organizations.name} ILIKE ${"%" + sanitized + "%"}`)
        .limit(50);
    } else {
      orgList = await db
        .select()
        .from(organizations)
        .orderBy(organizations.name)
        .limit(50);
    }

    return c.json({ clubs: orgList });
  } catch (err) {
    log.error({ err }, "Failed to fetch clubs");
    return c.json({ error: "Kunde inte hämta klubbar" }, 500);
  }
});

// ── Members ──────────────────────────────────────────────────

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  role: typeof users.role.enumValues[number];
  createdAt: Date;
};

portal.get("/members", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    let memberList: MemberRow[];
    if (session.orgId) {
      memberList = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.contactName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.orgId, session.orgId))
        .orderBy(users.contactName);
    } else if (session.role === "INTERNAL_ADMIN") {
      memberList = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.contactName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.contactName)
        .limit(100);
    } else {
      memberList = [];
    }

    return c.json({ members: memberList });
  } catch (err) {
    log.error({ err }, "Failed to fetch members");
    return c.json({ error: "Kunde inte hämta medlemmar" }, 500);
  }
});

// ── Sellers (sales team) ─────────────────────────────────────

portal.get("/sellers", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // /sellers exposes internal-staff (SALES_REP/SALES_ADMIN) directory.
  // Only platform admins should see it; previously any logged-in user
  // (including a CLUB_MEMBER on a personal shop) could enumerate it.
  if (session.role !== "INTERNAL_ADMIN" && session.role !== "SALES_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    const sellerList = await db
      .select({
        id: users.id,
        name: users.contactName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        sql`${users.role} IN ('SALES_REP', 'SALES_ADMIN')`
      )
      .orderBy(users.contactName);

    return c.json({ sellers: sellerList });
  } catch (err) {
    log.error({ err }, "Failed to fetch sellers");
    return c.json({ error: "Kunde inte hämta säljare" }, 500);
  }
});

// ── Quotes ───────────────────────────────────────────────────

portal.get("/quotes", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // LEFT JOIN organizations so the UI can render the club name in the
  // "Kund"-column. Previously the page fell back to "Klubb <orgId-prefix>"
  // because the API only returned `orgId`. This is the single SQL change
  // that turns the offert-tabellen into a real customer list.
  const baseSelect = {
    id: quotes.id,
    orgId: quotes.orgId,
    salesRepId: quotes.salesRepId,
    status: quotes.status,
    totalOre: quotes.totalOre,
    validUntil: quotes.validUntil,
    createdAt: quotes.createdAt,
    orgName: organizations.name,
  };

  try {
    let quoteList;
    if (session.role === "INTERNAL_ADMIN" || session.role === "SALES_ADMIN") {
      quoteList = await db
        .select(baseSelect)
        .from(quotes)
        .leftJoin(organizations, eq(quotes.orgId, organizations.id))
        .orderBy(desc(quotes.createdAt))
        .limit(100);
    } else {
      // quotes.salesRepId is the canonical column — there is no quotes.userId.
      quoteList = await db
        .select(baseSelect)
        .from(quotes)
        .leftJoin(organizations, eq(quotes.orgId, organizations.id))
        .where(eq(quotes.salesRepId, session.userId))
        .orderBy(desc(quotes.createdAt))
        .limit(100);
    }

    return c.json({ quotes: quoteList });
  } catch (err) {
    log.error({ err }, "Failed to fetch quotes");
    return c.json({ error: "Kunde inte hämta offerter" }, 500);
  }
});

// ── Statistics ───────────────────────────────────────────────

portal.get("/statistics", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const role = session.role;
  if (!isPortalRole(role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  // Statistics is order-revenue per month. Sales reps don't own orders,
  // so they get a 403 here (their stats live on /pipeline).
  if (role === "SALES_REP") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  // Club roles must have an orgId; otherwise we'd return platform-wide
  // revenue (the original `1=1` fallback).
  if ((role === "CLUB_ADMIN" || role === "CLUB_MEMBER") && !session.orgId) {
    return c.json({ error: "Klubbkontext saknas" }, 400);
  }

  const isPlatformAdmin = role === "INTERNAL_ADMIN" || role === "SALES_ADMIN";
  const orderScope =
    !isPlatformAdmin && session.orgId
      ? eq(orders.orgId, session.orgId)
      : sql`1=1`;

  try {
    const monthlyData = await db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        orderCount: sql<number>`count(*)`,
        revenueOre: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
      })
      .from(orders)
      .where(orderScope)
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .limit(12);

    // Additive: provide formatted SEK values and convenient top-level aliases
    // alongside the original monthlyData payload so UIs can display real values
    // without bespoke client-side formatting.
    const enriched = monthlyData.map((m) => ({
      ...m,
      revenue: formatSek(Number(m.revenueOre)),
      orders: Number(m.orderCount),
    }));
    const totals = enriched.reduce(
      (acc, m) => {
        acc.orders += Number(m.orderCount);
        acc.revenueOre += Number(m.revenueOre);
        return acc;
      },
      { orders: 0, revenueOre: 0 }
    );

    const payload: StatisticsResponse = {
      monthlyData: enriched.map((m) => ({
        month: String(m.month),
        orderCount: Number(m.orderCount),
        revenueOre: Number(m.revenueOre),
        orders: Number(m.orders),
        revenue: String(m.revenue),
      })),
      isDemo: enriched.length === 0,
      totals: {
        orders: totals.orders,
        revenueOre: totals.revenueOre,
        revenue: formatSek(totals.revenueOre),
      },
    };
    return c.json(payload);
  } catch (err) {
    log.error({ err }, "Failed to fetch statistics");
    return c.json({ error: "Kunde inte hämta statistik" }, 500);
  }
});

// ── Income / Revenue ─────────────────────────────────────────

portal.get("/income", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const role = session.role;
  if (!isPortalRole(role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (role === "SALES_REP") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if ((role === "CLUB_ADMIN" || role === "CLUB_MEMBER") && !session.orgId) {
    return c.json({ error: "Klubbkontext saknas" }, 400);
  }

  const isPlatformAdmin = role === "INTERNAL_ADMIN" || role === "SALES_ADMIN";
  const incomeScope =
    !isPlatformAdmin && session.orgId
      ? and(eq(orders.orgId, session.orgId), eq(orders.invoiceStatus, "PAID"))
      : eq(orders.invoiceStatus, "PAID");

  try {
    const monthlyRevenue = await db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        revenueOre: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(orders)
      .where(incomeScope)
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM') DESC`)
      .limit(6);

    const totalResult = await db
      .select({
        total: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
      })
      .from(orders)
      .where(incomeScope);

    const payload: IncomeResponse = {
      months: monthlyRevenue.map((m) => ({
        month: String(m.month),
        revenueOre: Number(m.revenueOre),
        orderCount: Number(m.orderCount),
      })),
      totalEarnedOre: Number(totalResult[0]?.total || 0),
    };
    return c.json(payload);
  } catch (err) {
    log.error({ err }, "Failed to fetch income");
    return c.json({ error: "Kunde inte hämta intäkter" }, 500);
  }
});

// ── Pipeline (deals/quotes by stage) ─────────────────────────

portal.get("/pipeline", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const role = session.role;
  // Pipeline is a sales-internal view (quotes pre-sale). Club roles and
  // fundraising roles must not see it — that would leak all clubs' quotes
  // platform-wide. Previously this endpoint had NO tenancy filter at all.
  if (role !== "SALES_REP" && role !== "SALES_ADMIN" && role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  // SALES_REP only sees their own quotes; SALES_ADMIN/INTERNAL_ADMIN see all.
  const repFilter =
    role === "SALES_REP" ? eq(quotes.salesRepId, session.userId) : sql`1=1`;

  try {
    const stages = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
    const byStage = await db
      .select({
        status: quotes.status,
        count: sql<number>`count(*)`,
        totalOre: sql<number>`coalesce(sum(${quotes.totalOre}), 0)`,
      })
      .from(quotes)
      .where(repFilter)
      .groupBy(quotes.status);

    const stageData = stages.map((s) => {
      const found = byStage.find((b) => b.status === s);
      return {
        stage: s,
        count: Number(found?.count || 0),
        totalOre: Number(found?.totalOre || 0),
      };
    });

    // Recent deals (non-empty list helps the pipeline page render real data).
    // LEFT JOIN organizations so the kanban-card can show the club name
    // instead of "Klubb <orgId-prefix>".
    const recentDeals = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        totalOre: quotes.totalOre,
        orgId: quotes.orgId,
        orgName: organizations.name,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .leftJoin(organizations, eq(quotes.orgId, organizations.id))
      .where(repFilter)
      .orderBy(desc(quotes.createdAt))
      .limit(25);

    const payload: PipelineResponse = {
      stages: stageData,
      deals: recentDeals.map((d) => ({
        id: d.id,
        status: String(d.status),
        totalOre: Number(d.totalOre),
        orgId: d.orgId,
        orgName: d.orgName,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      })),
    };
    return c.json(payload);
  } catch (err) {
    log.error({ err }, "Failed to fetch pipeline");
    return c.json({ error: "Kunde inte hämta pipeline" }, 500);
  }
});

// ── System Health ────────────────────────────────────────────

portal.get("/system", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const services: Array<{
    name: string;
    status: string;
    ok: boolean;
    latency: string;
    latencyMs: number;
    uptime: string;
  }> = [];

  const pushService = (name: string, ok: boolean, latencyMs: number) => {
    services.push({
      name,
      status: ok ? "Operativ" : "Nere",
      ok,
      latencyMs,
      latency: ok ? `${latencyMs} ms` : "—",
      uptime: "—",
    });
  };

  // PostgreSQL
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    pushService("PostgreSQL", true, Date.now() - start);
  } catch {
    pushService("PostgreSQL", false, 0);
  }

  // Redis
  try {
    const { redis } = await import("../lib/redis");
    const start = Date.now();
    await redis.ping();
    pushService("Redis", true, Date.now() - start);
  } catch {
    pushService("Redis", false, 0);
  }

  // API (always up if we reached here)
  pushService("API (Express)", true, 0);

  // AI / Open Claw — surface from env only; we don't ping OpenAI on
  // every admin page load.
  const aiConfigured =
    !!process.env.OPENAI_API_KEY &&
    !String(process.env.OPENAI_API_KEY).includes("REPLACE-ME");
  pushService("AI / Open Claw", aiConfigured, 0);

  // AI usage: best-effort, null-safe. UIs fall back to demo values when null.
  const aiUsage = {
    tokensToday: null,
    tokensMonth: null,
    sessions: null,
    avgResponseTime: null,
    model: process.env.OPENAI_DEFAULT_MODEL || "gpt-5.4-mini",
  };

  // Rate limits shape matches the admin System page so it can switch to
  // real numbers as soon as we start emitting gauges to Redis.
  const rateLimits = [
    { endpoint: "/v1/ai/public-chat", limit: "30/h", current: null, ok: true },
    { endpoint: "/v1/ai/chat", limit: "30/min", current: null, ok: true },
    { endpoint: "/v1/auth/*", limit: "20/min", current: null, ok: true },
    { endpoint: "/v1/orders", limit: "100/min", current: null, ok: true },
  ];

  // Recent events: read from audit_logs when present, otherwise null so the
  // page falls back to demo entries instead of an empty card.
  let recentEvents: Array<{
    text: string;
    time: string;
    type: string;
  }> | null = null;
  try {
    const { auditLogs } = await import("@roots/db/schema");
    const rows = await db
      .select({
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);
    if (rows.length > 0) {
      recentEvents = rows.map((r) => ({
        text: `${r.action}${r.entityType ? ` · ${r.entityType}` : ""}`,
        time: new Date(r.createdAt).toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type: "info",
      }));
    }
  } catch {
    recentEvents = null;
  }

  return c.json({ services, aiUsage, rateLimits, recentEvents });
});
