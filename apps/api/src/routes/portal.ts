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

const log = childLogger("portal");

export const portal = new Hono();

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

  try {
    const role = session.role;

    if (
      role === "CLUB_ADMIN" ||
      role === "CLUB_MEMBER"
    ) {
      const memberCount = session.orgId
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.orgId, session.orgId))
        : [{ count: 0 }];

      const orderCount = session.orgId
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(orders)
            .where(eq(orders.orgId, session.orgId))
        : [{ count: 0 }];

      const revenueResult = session.orgId
        ? await db
            .select({
              total: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
            })
            .from(orders)
            .where(
              and(
                eq(orders.orgId, session.orgId),
                eq(orders.invoiceStatus, "PAID")
              )
            )
        : [{ total: 0 }];

      return c.json({
        role,
        stats: {
          members: Number(memberCount[0]?.count || 0),
          orders: Number(orderCount[0]?.count || 0),
          revenueOre: Number(revenueResult[0]?.total || 0),
        },
      });
    }

    if (role === "SALES_REP" || role === "SALES_ADMIN") {
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

      return c.json({
        role,
        stats: {
          clubs: Number(clubCount[0]?.count || 0),
          quotesOut: Number(quoteCount[0]?.count || 0),
          closedThisMonth: Number(closedCount[0]?.count || 0),
          pipelineValueOre: Number(pipelineValue[0]?.total || 0),
        },
      });
    }

    // INTERNAL_ADMIN
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

    return c.json({
      role,
      stats: {
        totalOrders: Number(totalOrders[0]?.count || 0),
        totalClubs: Number(totalClubs[0]?.count || 0),
        mrrOre: Number(mrrResult[0]?.total || 0),
      },
    });
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

portal.get("/orders", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    let orderList;
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

    const [order] = await db
      .insert(orders)
      .values({
        orgId: session.orgId,
        userId: session.userId,
        status: "PENDING",
        totalOre,
      })
      .returning();

    if (lines.length > 0) {
      await db.insert(orderLines).values(
        lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          quantity: l.qty,
          unitPriceOre: l.unitPriceOre,
        }))
      );
    }

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

portal.get("/members", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    let memberList;
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

  try {
    let quoteList;
    if (session.role === "INTERNAL_ADMIN" || session.role === "SALES_ADMIN") {
      quoteList = await db
        .select()
        .from(quotes)
        .orderBy(desc(quotes.createdAt))
        .limit(100);
    } else {
      quoteList = await db
        .select()
        .from(quotes)
        .where(eq(quotes.userId, session.userId))
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

  try {
    const monthlyData = await db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        orderCount: sql<number>`count(*)`,
        revenueOre: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
      })
      .from(orders)
      .where(
        session.orgId
          ? eq(orders.orgId, session.orgId)
          : sql`1=1`
      )
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .limit(12);

    return c.json({ monthlyData });
  } catch (err) {
    log.error({ err }, "Failed to fetch statistics");
    return c.json({ error: "Kunde inte hämta statistik" }, 500);
  }
});

// ── Income / Revenue ─────────────────────────────────────────

portal.get("/income", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const monthlyRevenue = await db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        revenueOre: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(orders)
      .where(
        session.orgId
          ? and(eq(orders.orgId, session.orgId), eq(orders.invoiceStatus, "PAID"))
          : eq(orders.invoiceStatus, "PAID")
      )
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM') DESC`)
      .limit(6);

    const totalResult = await db
      .select({
        total: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
      })
      .from(orders)
      .where(
        session.orgId
          ? and(eq(orders.orgId, session.orgId), eq(orders.invoiceStatus, "PAID"))
          : eq(orders.invoiceStatus, "PAID")
      );

    return c.json({
      months: monthlyRevenue,
      totalEarnedOre: Number(totalResult[0]?.total || 0),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch income");
    return c.json({ error: "Kunde inte hämta intäkter" }, 500);
  }
});

// ── Pipeline (deals/quotes by stage) ─────────────────────────

portal.get("/pipeline", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const stages = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
    const byStage = await db
      .select({
        status: quotes.status,
        count: sql<number>`count(*)`,
        totalOre: sql<number>`coalesce(sum(${quotes.totalOre}), 0)`,
      })
      .from(quotes)
      .groupBy(quotes.status);

    return c.json({
      stages: stages.map((s) => {
        const found = byStage.find((b) => b.status === s);
        return {
          stage: s,
          count: Number(found?.count || 0),
          totalOre: Number(found?.totalOre || 0),
        };
      }),
    });
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

  const services = [];

  // Check DB
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    services.push({
      name: "PostgreSQL",
      status: "Operativ",
      ok: true,
      latencyMs: Date.now() - start,
    });
  } catch {
    services.push({
      name: "PostgreSQL",
      status: "Nere",
      ok: false,
      latencyMs: 0,
    });
  }

  // Check Redis
  try {
    const { redis } = await import("../lib/redis");
    const start = Date.now();
    await redis.ping();
    services.push({
      name: "Redis",
      status: "Operativ",
      ok: true,
      latencyMs: Date.now() - start,
    });
  } catch {
    services.push({
      name: "Redis",
      status: "Nere",
      ok: false,
      latencyMs: 0,
    });
  }

  services.push({
    name: "API",
    status: "Operativ",
    ok: true,
    latencyMs: 0,
  });

  return c.json({ services });
});
