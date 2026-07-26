import { Hono } from "hono";
import { eq, sql, desc, and, gte, lt, inArray, isNull } from "drizzle-orm";
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
import { isDemoSession } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog } from "../lib/audit";
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

  // P2.4 (audit 2026-05-26): list-endpointen släppte tidigare alla
  // sessioner med orgId vidare — fundraising-roller (ASSOCIATION_ADMIN
  // /TEAM_LEADER/SELLER) kunde enumerera B2B-orders för sin org.
  // Detail-endpointen ovan gör redan rätt med isPortalRole(); spegla.
  if (!isPortalRole(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

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

/**
 * Single B2B order detail — used by the order/invoice click-through
 * dialog on /portal/bestallningar and /portal/fakturor. Returns
 * order header + lines (joined with product names) + organization
 * name so the dialog can identify the buyer for INTERNAL_ADMIN /
 * SALES_ADMIN sessions that aren't scoped to an org.
 *
 * RBAC mirrors the list endpoint above: INTERNAL_ADMIN / SALES_ADMIN
 * see any order; everyone else can only see orders for their own org.
 * SELLER/TEAM_LEADER/ASSOCIATION_ADMIN are explicitly blocked because
 * they live on the fundraising side and have no business with B2B
 * subscription invoices.
 */
portal.get("/orders/:orderId", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!isPortalRole(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const orderId = c.req.param("orderId");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return c.json({ error: "Ogiltigt order-ID." }, 400);
  }

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: "Order hittades inte" }, 404);

    const isAdmin =
      session.role === "INTERNAL_ADMIN" || session.role === "SALES_ADMIN";
    const isOrgMember =
      !!session.orgId && session.orgId === order.orgId;
    if (!isAdmin && !isOrgMember) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, order.orgId))
      .limit(1);

    const [buyer] = await db
      .select({
        id: users.id,
        name: users.contactName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);

    const lines = await db
      .select({
        id: orderLines.id,
        productId: orderLines.productId,
        productName: products.name,
        productSku: products.sku,
        qty: orderLines.qty,
        unitPriceOre: orderLines.unitPriceOre,
      })
      .from(orderLines)
      .leftJoin(products, eq(orderLines.productId, products.id))
      .where(eq(orderLines.orderId, order.id));

    return c.json({
      order: {
        id: order.id,
        status: order.status,
        invoiceStatus: order.invoiceStatus,
        fortnoxInvoiceId: order.fortnoxInvoiceId,
        totalOre: order.totalOre,
        idempotencyKey: order.idempotencyKey,
        quoteId: order.quoteId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      organization: org ?? null,
      buyer: buyer ?? null,
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
    log.error({ err, orderId }, "Failed to fetch portal order detail");
    return c.json({ error: "Kunde inte hämta order" }, 500);
  }
});

portal.post("/orders", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // P2.4 (audit 2026-05-26): create-pathen är gate:ad på orgId men
  // inte på portal-roll — fundraising-roller med orgId kunde skapa
  // B2B-orders. isPortalRole spegar list/detail-endpointens kontroll.
  if (!isPortalRole(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  // Scout fix 2026-05-26 (Auth-C2): saknades isDemoSession-guard,
  // demo-konton kunde lägga riktiga B2B-orders.
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte skapa ordrar." }, 403);
  }

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

    // P2.22 (audit 2026-05-26): tidigare hoppades item-validering
    // helt — NaN/negativa qty fick passera och blev `NaN`-totals.
    // Spegla checkout.ts: max 100 per rad och högst 200 rader per
    // beställning för att hindra DoS-storlek.
    if (body.items.length > 200) {
      return c.json({ error: "För många rader i beställningen." }, 400);
    }
    for (const item of body.items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(item.productId) ||
        typeof item.qty !== "number" ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 100
      ) {
        return c.json(
          { error: "Ogiltig rad: productId måste vara UUID och qty 1–100." },
          400
        );
      }
    }

    const productIds = body.items.map((i) => i.productId);
    // P2.23 (audit 2026-05-26): byter raw `IN (${productIds})` mot
    // Drizzles `inArray` så bindningen är konsekvent med övriga
    // queries och utan risk för parameter-injection.
    const productList = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    // P2.21 (audit 2026-05-26): avvisa hela ordern om någon
    // productId är okänd. Tidigare drop:ades den raden tyst —
    // klienten trodde "alla items beställda" medan servern
    // persisterade en partiell order med lägre totalbelopp.
    const knownIds = new Set(productList.map((p) => p.id));
    const missingIds = productIds.filter((id) => !knownIds.has(id));
    if (missingIds.length > 0) {
      return c.json(
        {
          error: `En eller flera produkter hittades inte: ${missingIds.join(", ")}`,
          missingProductIds: missingIds,
        },
        400
      );
    }

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

    if (orgList.length === 0) {
      return c.json({ clubs: [] });
    }

    // Sprint E12: stitch aggregates (members / last order / revenue)
    // so the SALES_REP + INTERNAL_ADMIN klubbar table stops showing "—".
    // Three small grouped queries scoped to the page's 50 orgs is
    // cheaper than 50 N+1 round-trips, and still well within Postgres'
    // happy path for grouped counts/sums.
    const orgIds = orgList.map((o) => o.id);
    const orgIdsSql = sql.join(
      orgIds.map((id) => sql`${id}::uuid`),
      sql`, `
    );

    // Members per org. Counts every user in `users.org_id`. Filtering
    // by role would hide CLUB_MEMBER vs CLUB_ADMIN nuance; we include
    // both so the count matches what /portal/medlemmar shows.
    const memberRows = (await db.execute(
      sql`SELECT org_id::text AS org_id, COUNT(*)::int AS c
          FROM users
          WHERE org_id IN (${orgIdsSql})
          GROUP BY org_id`
    )) as unknown as Array<{ org_id: string; c: number }>;
    const memberMap = new Map(memberRows.map((r) => [r.org_id, Number(r.c)]));

    // Revenue + last order — union of paid B2C (customer_orders) and
    // B2B (orders). For B2C we only count PAID so we don't inflate
    // numbers with abandoned Klarna sessions; for B2B we count all
    // because invoiceStatus has its own lifecycle.
    const revB2cRows = (await db.execute(
      sql`SELECT org_id::text AS org_id,
                 COALESCE(SUM(total_ore), 0)::bigint AS total_ore,
                 MAX(created_at) AS last_at
          FROM customer_orders
          WHERE org_id IN (${orgIdsSql}) AND status = 'PAID'
          GROUP BY org_id`
    )) as unknown as Array<{
      org_id: string;
      total_ore: string;
      last_at: Date | string | null;
    }>;
    const revB2bRows = (await db.execute(
      sql`SELECT org_id::text AS org_id,
                 COALESCE(SUM(total_ore), 0)::bigint AS total_ore,
                 MAX(created_at) AS last_at
          FROM orders
          WHERE org_id IN (${orgIdsSql})
          GROUP BY org_id`
    )) as unknown as Array<{
      org_id: string;
      total_ore: string;
      last_at: Date | string | null;
    }>;

    const revenueMap = new Map<string, number>();
    const lastOrderMap = new Map<string, Date>();
    function ingest(rows: typeof revB2cRows) {
      for (const r of rows) {
        revenueMap.set(
          r.org_id,
          (revenueMap.get(r.org_id) ?? 0) + Number(r.total_ore)
        );
        if (r.last_at) {
          const d = r.last_at instanceof Date ? r.last_at : new Date(r.last_at);
          const cur = lastOrderMap.get(r.org_id);
          if (!cur || d > cur) lastOrderMap.set(r.org_id, d);
        }
      }
    }
    ingest(revB2cRows);
    ingest(revB2bRows);

    const enriched = orgList.map((o) => ({
      ...o,
      membersCount: memberMap.get(o.id) ?? 0,
      revenueOre: revenueMap.get(o.id) ?? 0,
      lastOrderAt: lastOrderMap.get(o.id)?.toISOString() ?? null,
    }));

    return c.json({ clubs: enriched });
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
        // P2.8 (audit 2026-05-26): exkludera GDPR-purgade tombstones
        // (deleted-{uuid}@roots.invalid). Tidigare visades de
        // anonymiserade raderna i medlemsdirektoriet vilket motverkar
        // KC2.7-intentionen.
        .where(and(eq(users.orgId, session.orgId), isNull(users.deletedAt)))
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
        .where(isNull(users.deletedAt))
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

// ── Invite member (Sprint C — "Knapparna fungerar") ──────────
//
// `POST /v1/portal/members/invite` powers the "Bjud in medlem"-button
// in the klubb-portalen. We create the user row immediately so the
// member shows up in the table on next load; the user can't log in
// until they accept the invite (random unguessable passwordHash
// blocks the DB-login path in `auth.ts`, and they don't have a session
// either). A real email invite would send a token-based link — this
// MVP keeps the surface honest while staying minimal.
portal.post("/members/invite", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // Only club admins (scoped to their own org) and platform admins.
  // CLUB_MEMBER, SALES_*, fundraising roles must not be able to grow
  // the directory.
  const canInvite =
    (session.role === "CLUB_ADMIN" && !!session.orgId) ||
    session.role === "INTERNAL_ADMIN";
  if (!canInvite) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  // MASTERPLAN_01 KC2.1: demo-INTERNAL_ADMIN passerar role-checken men
  // skulle skicka ett RIKTIGT invite-email + lagra DB-rad mot whatever
  // orgId (eller null). Blockera innan något skickas.
  if (isDemoSession(session)) {
    return c.json(
      { error: "Demoläget kan inte skicka riktiga inbjudningar." },
      403
    );
  }

  type InviteBody = {
    email?: string;
    contactName?: string;
    role?: "CLUB_MEMBER" | "CLUB_ADMIN";
  };
  let body: InviteBody;
  try {
    body = await c.req.json<InviteBody>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const email = (body.email ?? "").toLowerCase().trim();
  const contactName = (body.contactName ?? "").trim();
  const requestedRole = body.role === "CLUB_ADMIN" ? "CLUB_ADMIN" : "CLUB_MEMBER";

  // Conservative email validation. Real registration goes through
  // /auth/register/* which has its own validator; here we just block
  // obviously wrong input so the DB constraint isn't the first guard.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    return c.json({ error: "Ogiltig e-postadress" }, 400);
  }
  if (contactName.length > 255) {
    return c.json({ error: "Namnet är för långt" }, 400);
  }

  // CLUB_ADMIN can only invite into their own org. INTERNAL_ADMIN can
  // pass an explicit orgId (e.g. support-staff onboarding for a club),
  // but for the demo we keep it simple: use the caller's org.
  const orgId = session.orgId;
  if (!orgId) {
    return c.json({ error: "Klubbkontext saknas" }, 400);
  }

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return c.json({ error: "E-postadressen är redan registrerad" }, 409);
    }

    // Unguessable random bytes serialized as hex. Real password reset/
    // accept-invite flow will replace this; until then the user simply
    // cannot log in. (auth.ts verifies argon2 — a 64-char hex blob is
    // not a valid argon2 hash and will reject.)
    const blockingHash = `invite-pending-${crypto.randomUUID()}${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash: blockingHash,
        role: requestedRole,
        orgId,
        contactName: contactName || null,
      })
      .returning({
        id: users.id,
        email: users.email,
        contactName: users.contactName,
        role: users.role,
        createdAt: users.createdAt,
      });

    return c.json(
      {
        member: {
          id: created.id,
          email: created.email,
          name: created.contactName,
          role: created.role,
          createdAt:
            created.createdAt instanceof Date
              ? created.createdAt.toISOString()
              : created.createdAt,
        },
      },
      201
    );
  } catch (err) {
    log.error({ err }, "Failed to invite member");
    return c.json({ error: "Kunde inte bjuda in medlem" }, 500);
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

    if (sellerList.length === 0) {
      return c.json({
        sellers: [],
        totals: { pipelineOre: 0, closedOre: 0, avgConversion: null },
      });
    }

    // Sprint E12: per-seller aggregates so /portal/saljare's KPI cards
    // and table actually show numbers instead of "—". One grouped query
    // over quotes (pipeline + closed + rejected counts) and one over
    // organizations (assigned-club count) — cheap even with thousands
    // of reps, since we group by salesRepId.
    const quoteAggRows = (await db.execute(
      sql`SELECT sales_rep_id::text AS sales_rep_id,
                 COALESCE(SUM(CASE WHEN status IN ('DRAFT','SENT') THEN total_ore ELSE 0 END), 0)::bigint AS pipeline_ore,
                 COALESCE(SUM(CASE WHEN status = 'ACCEPTED' THEN total_ore ELSE 0 END), 0)::bigint AS closed_ore,
                 COUNT(*) FILTER (WHERE status = 'ACCEPTED')::int AS won_count,
                 COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS lost_count,
                 COUNT(*)::int AS total_count
          FROM quotes
          WHERE sales_rep_id IS NOT NULL
          GROUP BY sales_rep_id`
    )) as unknown as Array<{
      sales_rep_id: string;
      pipeline_ore: string;
      closed_ore: string;
      won_count: number;
      lost_count: number;
      total_count: number;
    }>;

    const clubAggRows = (await db.execute(
      sql`SELECT assigned_asm_user_id::text AS user_id, COUNT(*)::int AS c
          FROM organizations
          WHERE assigned_asm_user_id IS NOT NULL
          GROUP BY assigned_asm_user_id`
    )) as unknown as Array<{ user_id: string; c: number }>;

    const quoteMap = new Map(
      quoteAggRows.map((r) => [
        r.sales_rep_id,
        {
          pipelineOre: Number(r.pipeline_ore),
          closedOre: Number(r.closed_ore),
          wonCount: r.won_count,
          // Conversion = won / (won + lost). Open quotes are excluded
          // because they're still in-play; including them punishes new
          // reps whose pipeline is still warming up.
          conversion:
            r.won_count + r.lost_count > 0
              ? Math.round((r.won_count / (r.won_count + r.lost_count)) * 100)
              : null,
        },
      ])
    );
    const clubMap = new Map(clubAggRows.map((r) => [r.user_id, r.c]));

    const enriched = sellerList.map((s) => {
      const q = quoteMap.get(s.id);
      return {
        ...s,
        clubs: clubMap.get(s.id) ?? 0,
        pipelineOre: q?.pipelineOre ?? 0,
        closedOre: q?.closedOre ?? 0,
        conversion: q?.conversion ?? null,
      };
    });

    const totals = {
      pipelineOre: enriched.reduce((sum, s) => sum + s.pipelineOre, 0),
      closedOre: enriched.reduce((sum, s) => sum + s.closedOre, 0),
      avgConversion:
        (() => {
          const withConv = enriched.filter(
            (s): s is typeof s & { conversion: number } =>
              typeof s.conversion === "number"
          );
          if (withConv.length === 0) return null;
          return Math.round(
            withConv.reduce((sum, s) => sum + s.conversion, 0) / withConv.length
          );
        })(),
    };

    return c.json({ sellers: enriched, totals });
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

// ── Move a quote between pipeline stages ─────────────────────
//
// `PATCH /v1/portal/quotes/:id/status` backs drag-and-drop on the
// pipeline board (and the stage-picker in the deal dialog, which is the
// keyboard/touch path to the same thing).
//
// Transitions are deliberately NOT restricted to a forward-only funnel:
// a rep who drops a card on the wrong column must be able to drag it
// back, and "Nekad → Skickad" is a real thing that happens when a club
// changes its mind. Every move is audit-logged so the history survives
// even though `quotes` only keeps the current status.
portal.patch("/quotes/:id/status", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  if (
    session.role !== "SALES_REP" &&
    session.role !== "SALES_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: "Demoläget kan inte ändra riktiga offerter." }, 403);
  }

  const quoteId = c.req.param("id");
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(quoteId)) {
    return c.json({ error: "Ogiltigt offert-ID." }, 400);
  }

  let body: { status?: string };
  try {
    body = await c.req.json<{ status?: string }>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  // EXPIRED exists in the SQL enum but has no column on the board — it is
  // a lifecycle state we set from `validUntil`, not something a rep drags
  // a card into. Accepting it here would strand the card off-board.
  const ALLOWED = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
  type AllowedStatus = (typeof ALLOWED)[number];
  const status = ALLOWED.find((s) => s === body.status) as
    | AllowedStatus
    | undefined;
  if (!status) {
    return c.json(
      { error: `status måste vara en av: ${ALLOWED.join(", ")}` },
      400
    );
  }

  try {
    const [existing] = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        orgId: quotes.orgId,
        salesRepId: quotes.salesRepId,
        totalOre: quotes.totalOre,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Offerten hittades inte" }, 404);
    }
    // A rep may only move their own quotes. Admins move anyone's.
    if (
      session.role === "SALES_REP" &&
      existing.salesRepId !== session.userId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const previousStatus = String(existing.status);

    // No-op moves (dropped back on the same column) shouldn't bump
    // updatedAt — that would reset the "days in stage" badge and make the
    // board lie about how long a deal has been sitting still.
    if (previousStatus === status) {
      // Report the stored timestamp, not `now`. The client feeds this back
      // into the card's "days in stage" badge, so inventing a fresh one
      // would zero the badge on a move that changed nothing.
      const unchangedAt =
        existing.updatedAt instanceof Date
          ? existing.updatedAt.toISOString()
          : (existing.updatedAt ?? new Date().toISOString());
      return c.json({
        quote: {
          id: existing.id,
          status,
          totalOre: existing.totalOre,
          orgId: existing.orgId,
          updatedAt: unchangedAt,
        },
        orgPromotedToCustomer: false,
      });
    }

    // The stage change and the LEAD → CUSTOMER promotion are one decision,
    // so they share a transaction. Committed separately, a crash in between
    // leaves an accepted quote on a club that every CRM report still counts
    // as an open lead — and nothing in the flow would ever retry it.
    const { updated, orgPromotedToCustomer } = await db.transaction(
      async (tx) => {
        const [row] = await tx
          .update(quotes)
          .set({ status, updatedAt: new Date() })
          .where(eq(quotes.id, quoteId))
          .returning({
            id: quotes.id,
            status: quotes.status,
            totalOre: quotes.totalOre,
            orgId: quotes.orgId,
            updatedAt: quotes.updatedAt,
          });

        // Accepting a quote is the moment a lead becomes a customer.
        // Without this the club would stay `crm_status='LEAD'` forever.
        let promotedOrg = false;
        if (status === "ACCEPTED") {
          const promoted = await tx
            .update(organizations)
            .set({ crmStatus: "CUSTOMER", updatedAt: new Date() })
            .where(
              and(
                eq(organizations.id, existing.orgId),
                eq(organizations.crmStatus, "LEAD")
              )
            )
            .returning({ id: organizations.id });
          promotedOrg = promoted.length > 0;
        }

        return { updated: row, orgPromotedToCustomer: promotedOrg };
      }
    );

    await auditLog({
      userId: session.userId,
      action: "sales.quote.status_changed",
      entityType: "quote",
      entityId: quoteId,
      meta: {
        from: previousStatus,
        to: status,
        orgId: existing.orgId,
        totalOre: existing.totalOre,
        orgPromotedToCustomer,
      },
    });

    return c.json({
      quote: {
        id: updated.id,
        status: String(updated.status),
        totalOre: Number(updated.totalOre),
        orgId: updated.orgId,
        updatedAt:
          updated.updatedAt instanceof Date
            ? updated.updatedAt.toISOString()
            : updated.updatedAt,
      },
      orgPromotedToCustomer,
    });
  } catch (err) {
    log.error({ err, quoteId }, "Failed to update quote status");
    return c.json({ error: "Kunde inte flytta offerten" }, 500);
  }
});

// ── Create quote (Sprint C — "Knapparna fungerar") ───────────
//
// `POST /v1/portal/quotes` powers the "Ny offert"-button in the säljar-
// portalen. Sales-internal endpoint only:
//   - role must be SALES_REP / SALES_ADMIN / INTERNAL_ADMIN
//   - `salesRepId` is always the calling user (a rep can't ghost-write a
//     quote for someone else)
//   - line-item prices are looked up server-side from `products.priceOre`
//     so the client can't tamper with totalOre by sending lower numbers
//
// The whole insert (quote + lines) runs in one transaction so a partial
// failure can't leave us with an orphan quote header.
portal.post("/quotes", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  if (
    session.role !== "SALES_REP" &&
    session.role !== "SALES_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  // MASTERPLAN_01 KC2.1: demo-säljaren saknar pipeline-context och
  // skulle annars kunna skapa offerter mot RIKTIGA orgIds (body.orgId
  // är vad som helst supplied by client). Stäng vägen.
  if (isDemoSession(session)) {
    return c.json(
      { error: "Demoläget kan inte skapa riktiga offerter." },
      403
    );
  }

  type CreateQuoteBody = {
    orgId?: string;
    lines?: Array<{ productId?: string; qty?: number }>;
    validUntilDays?: number;
    status?: "DRAFT" | "SENT";
  };

  let body: CreateQuoteBody;
  try {
    body = await c.req.json<CreateQuoteBody>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.orgId || !UUID_RE.test(body.orgId)) {
    return c.json({ error: "orgId krävs (uuid)" }, 400);
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return c.json({ error: "Minst en rad krävs" }, 400);
  }
  if (body.lines.length > 50) {
    return c.json({ error: "Max 50 rader per offert" }, 400);
  }

  const cleanedLines: Array<{ productId: string; qty: number }> = [];
  for (const raw of body.lines) {
    if (!raw || typeof raw !== "object") {
      return c.json({ error: "Ogiltig rad" }, 400);
    }
    if (!raw.productId || !UUID_RE.test(raw.productId)) {
      return c.json({ error: "Ogiltigt productId" }, 400);
    }
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      return c.json({ error: "qty måste vara 1–10000" }, 400);
    }
    cleanedLines.push({ productId: raw.productId, qty });
  }

  const status = body.status === "SENT" ? "SENT" : "DRAFT";
  const validDays = Number.isInteger(body.validUntilDays)
    ? Math.max(1, Math.min(365, Number(body.validUntilDays)))
    : 30;

  try {
    // Verify the org exists. Anyone with SALES_REP can quote any
    // organization in the discovery directory (matches /clubs), so we
    // only assert existence, not ownership.
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, body.orgId))
      .limit(1);
    if (!org) {
      return c.json({ error: "Förening hittades inte" }, 404);
    }

    // Pull canonical prices server-side. Any productId the client sent
    // that isn't in the catalog → 400 (don't silently drop it).
    const productIds = Array.from(
      new Set(cleanedLines.map((l) => l.productId))
    );
    // P2.23 (audit 2026-05-26): byt sql`… IN ${productIds}` mot
    // Drizzles `inArray` så bindningen är konsekvent.
    const productRows = await db
      .select({ id: products.id, priceOre: products.priceOre })
      .from(products)
      .where(inArray(products.id, productIds));
    const priceById = new Map(productRows.map((p) => [p.id, p.priceOre]));
    for (const l of cleanedLines) {
      if (!priceById.has(l.productId)) {
        return c.json({ error: `Okänd produkt: ${l.productId}` }, 400);
      }
    }

    const totalOre = cleanedLines.reduce((sum, l) => {
      const unit = priceById.get(l.productId) ?? 0;
      return sum + unit * l.qty;
    }, 0);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const inserted = await db.transaction(async (tx) => {
      const [quoteRow] = await tx
        .insert(quotes)
        .values({
          orgId: org.id,
          salesRepId: session.userId,
          status,
          totalOre,
          validUntil,
        })
        .returning();

      await tx.insert(quoteLines).values(
        cleanedLines.map((l) => ({
          quoteId: quoteRow.id,
          productId: l.productId,
          qty: l.qty,
          unitPriceOre: priceById.get(l.productId) ?? 0,
        }))
      );

      return quoteRow;
    });

    return c.json(
      {
        quote: {
          id: inserted.id,
          orgId: inserted.orgId,
          orgName: org.name,
          salesRepId: inserted.salesRepId,
          status: inserted.status,
          totalOre: inserted.totalOre,
          validUntil: inserted.validUntil
            ? inserted.validUntil instanceof Date
              ? inserted.validUntil.toISOString()
              : inserted.validUntil
            : null,
          createdAt:
            inserted.createdAt instanceof Date
              ? inserted.createdAt.toISOString()
              : inserted.createdAt,
        },
      },
      201
    );
  } catch (err) {
    log.error({ err }, "Failed to create quote");
    return c.json({ error: "Kunde inte skapa offert" }, 500);
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

    // ── KPI block (rolling 30-day windows) ────────────────────────────
    // Sprint E4: feed the four KPI cards at the top of /portal/statistik
    // and the top-products list to the right of the revenue chart with
    // real data. All windows are *rolling* off `now()` so the cards stay
    // meaningful even mid-month.
    const now = new Date();
    const period30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const period60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const buildPeriodAgg = async (since: Date, until: Date | null) => {
      // Use the drizzle `lt` helper rather than a raw `sql\`...\``
      // template — the `postgres` driver rejects raw Date params with
      // ERR_INVALID_ARG_TYPE, which broke /portal/statistik for every
      // role in the E5 smoketest until this fix.
      const where = until
        ? and(orderScope, gte(orders.createdAt, since), lt(orders.createdAt, until))
        : and(orderScope, gte(orders.createdAt, since));
      const rows = await db
        .select({
          orderCount: sql<number>`count(*)`,
          revenueOre: sql<number>`coalesce(sum(${orders.totalOre}), 0)`,
          uniqueUsers: sql<number>`count(distinct ${orders.userId})`,
        })
        .from(orders)
        .where(where);
      const row = rows[0] ?? { orderCount: 0, revenueOre: 0, uniqueUsers: 0 };
      return {
        orderCount: Number(row.orderCount),
        revenueOre: Number(row.revenueOre),
        uniqueUsers: Number(row.uniqueUsers),
      };
    };

    const [curr, prev] = await Promise.all([
      buildPeriodAgg(period30, null),
      buildPeriodAgg(period60, period30),
    ]);

    // New-members scope mirrors the order scope: org-scoped users for
    // CLUB roles, platform-wide for INTERNAL_ADMIN/SALES_ADMIN.
    const memberScope =
      !isPlatformAdmin && session.orgId
        ? eq(users.orgId, session.orgId)
        : sql`1=1`;
    const [{ count: newMembers30 } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(memberScope, gte(users.createdAt, period30)));
    const [{ count: newMembers60 } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          memberScope,
          gte(users.createdAt, period60),
          lt(users.createdAt, period30)
        )
      );

    const pct = (currVal: number, prevVal: number): number | null => {
      if (prevVal <= 0) return null;
      return Math.round(((currVal - prevVal) / prevVal) * 1000) / 10;
    };

    const avgOrderValueOre =
      curr.orderCount > 0 ? Math.round(curr.revenueOre / curr.orderCount) : 0;

    const kpis = {
      totalRevenueOre: curr.revenueOre,
      totalRevenue: formatSek(curr.revenueOre),
      avgOrderValueOre,
      avgOrderValue: formatSek(avgOrderValueOre),
      totalOrders: curr.orderCount,
      newMembersThisPeriod: Number(newMembers30),
      activeMembersThisPeriod: curr.uniqueUsers,
      prevPeriodRevenuePercent: pct(curr.revenueOre, prev.revenueOre),
      prevPeriodOrdersPercent: pct(curr.orderCount, prev.orderCount),
      prevPeriodMembersPercent: pct(Number(newMembers30), Number(newMembers60)),
    };

    // ── Top products (rolling 90-day window) ──────────────────────────
    // Joined through order_lines → products. We deliberately use a 90-day
    // window for top-products since it stays useful even when last month
    // had few orders, while still excluding old discontinued SKUs.
    const period90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const topRows = await db
      .select({
        productId: products.id,
        name: products.name,
        slug: products.slug,
        soldUnits: sql<number>`coalesce(sum(${orderLines.qty}), 0)`,
        revenueOre: sql<number>`coalesce(sum(${orderLines.qty} * ${orderLines.unitPriceOre}), 0)`,
      })
      .from(orderLines)
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .innerJoin(products, eq(orderLines.productId, products.id))
      .where(and(orderScope, gte(orders.createdAt, period90)))
      .groupBy(products.id, products.name, products.slug)
      .orderBy(desc(sql`sum(${orderLines.qty} * ${orderLines.unitPriceOre})`))
      .limit(5);

    const topTotalOre = topRows.reduce(
      (acc, r) => acc + Number(r.revenueOre),
      0
    );
    const topProducts = topRows.map((r) => {
      const revOre = Number(r.revenueOre);
      const share =
        topTotalOre > 0 ? Math.round((revOre / topTotalOre) * 1000) / 10 : 0;
      return {
        productId: String(r.productId),
        name: String(r.name),
        slug: String(r.slug),
        soldUnits: Number(r.soldUnits),
        revenueOre: revOre,
        revenue: formatSek(revOre),
        sharePercent: share,
      };
    });

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
      kpis,
      topProducts,
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

  // Sprint E12: leads created via POST /v1/sales/leads previously
  // vanished — they were inserted as `organizations` rows with
  // `crm_status='LEAD'` but the pipeline only read `quotes`. We now
  // union those orgs into a synthetic "LEAD" stage so a fresh lead
  // shows up the moment the rep clicks "Spara".
  // SALES_REP only sees orgs assigned to them, admins see all.
  //
  // The LEAD stage means "no quote yet". Without the NOT EXISTS below a
  // club appeared in BOTH the LEAD column and its quote's column, because
  // writing a quote never clears `crm_status='LEAD'` (that flips to
  // CUSTOMER only when a quote is accepted). Deriving the stage from the
  // absence of a quote keeps the board single-source-of-truth: creating a
  // quote moves the card right, deleting it moves the card back, and no
  // dual-write can drift. Scoped per viewer so a rep doesn't lose a lead
  // just because a colleague quoted the same club.
  const noQuoteYet =
    role === "SALES_REP"
      ? sql`NOT EXISTS (SELECT 1 FROM ${quotes} WHERE ${quotes.orgId} = ${organizations.id} AND ${quotes.salesRepId} = ${session.userId})`
      : sql`NOT EXISTS (SELECT 1 FROM ${quotes} WHERE ${quotes.orgId} = ${organizations.id})`;
  const leadFilter =
    role === "SALES_REP"
      ? and(
          sql`${organizations.crmStatus} = 'LEAD' AND ${organizations.assignedAsmUserId} = ${session.userId}`,
          noQuoteYet
        )
      : and(sql`${organizations.crmStatus} = 'LEAD'`, noQuoteYet);

  try {
    const stages = ["LEAD", "DRAFT", "SENT", "ACCEPTED", "REJECTED"];
    const byStage = await db
      .select({
        status: quotes.status,
        count: sql<number>`count(*)`,
        totalOre: sql<number>`coalesce(sum(${quotes.totalOre}), 0)`,
      })
      .from(quotes)
      .where(repFilter)
      .groupBy(quotes.status);

    // Count lead orgs separately. We don't have a "quote totalOre" for
    // unquoted leads, so the LEAD column shows count + potential-score
    // proxy is left to the FE (which already has potentialScore on the
    // org if it cares to fetch /clubs).
    const [{ leadCount }] = await db
      .select({
        leadCount: sql<number>`count(*)`,
      })
      .from(organizations)
      .where(leadFilter);

    const stageData = stages.map((s) => {
      if (s === "LEAD") {
        return {
          stage: "LEAD",
          count: Number(leadCount || 0),
          totalOre: 0,
        };
      }
      const found = byStage.find((b) => b.status === s);
      return {
        stage: s,
        count: Number(found?.count || 0),
        totalOre: Number(found?.totalOre || 0),
      };
    });

    // Recent deals from `quotes` (existing behaviour).
    const recentDeals = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        totalOre: quotes.totalOre,
        orgId: quotes.orgId,
        orgName: organizations.name,
        createdAt: quotes.createdAt,
        // `updatedAt` is what the board's age badge should count from — a
        // quote sitting 40 days in SENT is the signal a rep needs, not the
        // day it was first drafted.
        stageSince: quotes.updatedAt,
        municipality: organizations.municipality,
      })
      .from(quotes)
      .leftJoin(organizations, eq(quotes.orgId, organizations.id))
      .where(repFilter)
      .orderBy(desc(quotes.createdAt))
      .limit(25);

    // Recent leads — surfaced as synthetic "deals" with status="LEAD"
    // and totalOre=0 so the kanban can show them in the first column.
    // We deliberately use `id = organizations.id` so the FE's react-key
    // never collides with a quote id (UUIDs are globally unique anyway).
    const recentLeads = await db
      .select({
        id: organizations.id,
        orgId: organizations.id,
        orgName: organizations.name,
        createdAt: organizations.createdAt,
        potentialScore: organizations.potentialScore,
        leadSource: organizations.leadSource,
        municipality: organizations.municipality,
      })
      .from(organizations)
      .where(leadFilter)
      .orderBy(desc(organizations.createdAt))
      .limit(25);

    const iso = (v: Date | string | null): string | null =>
      v instanceof Date ? v.toISOString() : v;

    const dealsFromQuotes: PipelineResponse["deals"] = recentDeals.map((d) => ({
      id: d.id,
      kind: "QUOTE",
      status: String(d.status),
      totalOre: Number(d.totalOre),
      orgId: d.orgId,
      orgName: d.orgName,
      municipality: d.municipality,
      createdAt: iso(d.createdAt) ?? new Date().toISOString(),
      stageSince: iso(d.stageSince ?? d.createdAt),
    }));

    const dealsFromLeads: PipelineResponse["deals"] = recentLeads.map((l) => ({
      id: l.id,
      kind: "LEAD",
      status: "LEAD",
      totalOre: 0,
      orgId: l.orgId,
      orgName: l.orgName,
      municipality: l.municipality,
      createdAt: iso(l.createdAt) ?? new Date().toISOString(),
      stageSince: iso(l.createdAt),
      potentialScore: l.potentialScore,
      leadSource: l.leadSource,
    }));

    const payload: PipelineResponse = {
      stages: stageData,
      // Leads first so the LEAD column populates even when the rep has
      // 25 active quotes that would otherwise eat the entire 25-row cap.
      deals: [...dealsFromLeads, ...dealsFromQuotes],
      // Demo logins share the seeded data, so PATCH /quotes/:id/status
      // refuses them. Say so up front instead of letting the board offer a
      // drag that always ends in a 403.
      readOnly: isDemoSession(session),
    };
    return c.json(payload);
  } catch (err) {
    log.error({ err }, "Failed to fetch pipeline");
    return c.json({ error: "Kunde inte hämta pipeline" }, 500);
  }
});

// ── Pipeline deal detail (backs the board's detail dialog) ────
//
// `GET /v1/portal/pipeline/deals/:kind/:id` where kind is `lead` (an
// organizations row without a quote) or `quote`. One endpoint for both so
// the client has a single fetch path; the payload is discriminated by
// `kind`. Tenancy mirrors GET /pipeline exactly: a SALES_REP may only
// open their own quotes and the leads assigned to them.
portal.get("/pipeline/deals/:kind/:id", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const role = session.role;
  if (role !== "SALES_REP" && role !== "SALES_ADMIN" && role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const kindParam = c.req.param("kind");
  const id = c.req.param("id");
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (kindParam !== "lead" && kindParam !== "quote") {
    return c.json({ error: "kind måste vara 'lead' eller 'quote'" }, 400);
  }
  if (!UUID_RE.test(id)) {
    return c.json({ error: "Ogiltigt ID." }, 400);
  }

  const iso = (v: Date | string | null | undefined): string | null =>
    v instanceof Date ? v.toISOString() : (v ?? null);

  try {
    // The club behind the card. For a quote we resolve it via the quote,
    // for a lead the id *is* the org id.
    let orgId = id;
    let quoteRow:
      | {
          id: string;
          status: string;
          totalOre: number;
          orgId: string;
          salesRepId: string;
          validUntil: Date | string | null;
          createdAt: Date | string;
          updatedAt: Date | string;
        }
      | undefined;

    if (kindParam === "quote") {
      const [q] = await db
        .select({
          id: quotes.id,
          status: quotes.status,
          totalOre: quotes.totalOre,
          orgId: quotes.orgId,
          salesRepId: quotes.salesRepId,
          validUntil: quotes.validUntil,
          createdAt: quotes.createdAt,
          updatedAt: quotes.updatedAt,
        })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      if (!q) return c.json({ error: "Offerten hittades inte" }, 404);
      if (role === "SALES_REP" && q.salesRepId !== session.userId) {
        return c.json({ error: "Behörighet saknas" }, 403);
      }
      quoteRow = { ...q, status: String(q.status) };
      orgId = q.orgId;
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        orgNumber: organizations.orgNumber,
        type: organizations.type,
        sportType: organizations.sportType,
        municipality: organizations.municipality,
        region: organizations.region,
        website: organizations.website,
        crmStatus: organizations.crmStatus,
        leadSource: organizations.leadSource,
        potentialScore: organizations.potentialScore,
        assignedAsmUserId: organizations.assignedAsmUserId,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!org) return c.json({ error: "Föreningen hittades inte" }, 404);

    // A rep opening a LEAD card must own it. (For quotes the ownership
    // check above already applies — the club itself may be assigned to a
    // colleague while the quote is mine.)
    if (
      kindParam === "lead" &&
      role === "SALES_REP" &&
      org.assignedAsmUserId !== session.userId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const [{ membersCount }] = await db
      .select({ membersCount: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.orgId, orgId));

    // Quote lines, only meaningful for the quote kind.
    const lines = quoteRow
      ? await db
          .select({
            productName: products.name,
            sku: products.sku,
            qty: quoteLines.qty,
            unitPriceOre: quoteLines.unitPriceOre,
          })
          .from(quoteLines)
          .leftJoin(products, eq(quoteLines.productId, products.id))
          .where(eq(quoteLines.quoteId, quoteRow.id))
      : [];

    // Sibling quotes for the same club so the rep sees the history. Scoped
    // to the rep's own quotes for SALES_REP, same as the board.
    const otherQuoteRows = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        totalOre: quotes.totalOre,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .where(
        role === "SALES_REP"
          ? and(
              eq(quotes.orgId, orgId),
              eq(quotes.salesRepId, session.userId)
            )
          : eq(quotes.orgId, orgId)
      )
      .orderBy(desc(quotes.createdAt))
      .limit(10);

    // Who owns this deal: the quote's rep, or for a lead the assigned ASM.
    // (Admins see other people's cards, so "—" would hide who to ask.)
    const ownerId = quoteRow ? quoteRow.salesRepId : org.assignedAsmUserId;
    let salesRepName: string | null = null;
    if (ownerId) {
      const [rep] = await db
        .select({ contactName: users.contactName, email: users.email })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);
      salesRepName = rep?.contactName ?? rep?.email ?? null;
    }

    return c.json({
      deal: {
        kind: kindParam === "quote" ? "QUOTE" : "LEAD",
        id,
        status: quoteRow ? quoteRow.status : "LEAD",
        totalOre: quoteRow ? Number(quoteRow.totalOre) : 0,
        createdAt: iso(quoteRow ? quoteRow.createdAt : org.createdAt),
        stageSince: iso(quoteRow ? quoteRow.updatedAt : org.createdAt),
        validUntil: quoteRow ? iso(quoteRow.validUntil) : null,
        salesRepName,
        org: {
          id: org.id,
          name: org.name,
          orgNumber: org.orgNumber,
          type: org.type,
          sportType: org.sportType,
          municipality: org.municipality,
          region: org.region,
          website: org.website,
          crmStatus: org.crmStatus,
          leadSource: org.leadSource,
          potentialScore: org.potentialScore,
          membersCount: Number(membersCount || 0),
        },
        lines: lines.map((l) => ({
          productName: l.productName ?? "Okänd produkt",
          sku: l.sku,
          qty: Number(l.qty),
          unitPriceOre: Number(l.unitPriceOre),
          lineTotalOre: Number(l.unitPriceOre) * Number(l.qty),
        })),
        otherQuotes: otherQuoteRows
          .filter((q) => q.id !== id)
          .map((q) => ({
            id: q.id,
            status: String(q.status),
            totalOre: Number(q.totalOre),
            createdAt: iso(q.createdAt),
          })),
      },
    });
  } catch (err) {
    log.error({ err, kindParam, id }, "Failed to fetch pipeline deal detail");
    return c.json({ error: "Kunde inte hämta affären" }, 500);
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

  // MASTERPLAN_01 KC8.2: surface email, payment & invoicing config so
  // ops kan se vid en blick vad som är degraderat utan att läsa loggar.
  // Vi pingar inte providers (skulle slå mot rate-limits) — bara
  // env-konfiguration.
  const emailConfigured = !!process.env.RESEND_API_KEY;
  pushService("E-post (Resend)", emailConfigured, 0);

  const klarnaConfigured =
    !!process.env.KLARNA_USERNAME && !!process.env.KLARNA_PASSWORD;
  pushService("Betalning (Klarna)", klarnaConfigured, 0);

  const klarnaWebhookProtected =
    !!process.env.KLARNA_WEBHOOK_SECRET ||
    !!process.env.KLARNA_WEBHOOK_IPS;
  pushService("Klarna webhook", klarnaWebhookProtected, 0);

  const fortnoxEnabled = process.env.FORTNOX_ENABLED === "true";
  const fortnoxConfigured =
    !fortnoxEnabled ||
    (!!process.env.FORTNOX_TOKEN && !!process.env.FORTNOX_CLIENT_SECRET);
  pushService(
    fortnoxEnabled ? "Fortnox (aktiv)" : "Fortnox (avstängd)",
    fortnoxConfigured,
    0
  );

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
