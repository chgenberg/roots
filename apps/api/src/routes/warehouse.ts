/**
 * Från betald order till lagret — bara INTERNAL_ADMIN.
 *
 *   GET  /v1/admin/warehouse/orders              listan (kö, hos lagret, alla)
 *   POST /v1/admin/warehouse/reconcile           stäm av ordrar mot Stripe
 *   POST /v1/admin/warehouse/batches             godkänn och skicka till lagret
 *   GET  /v1/admin/warehouse/batches             senaste sändningarna
 *   GET  /v1/admin/warehouse/batches/:id/picklist  plocklista (xlsx eller csv)
 *   POST /v1/admin/warehouse/ship                markera skickade, i grupp
 *
 * Flödet är dagligt och en människa godkänner: ordrarna som blivit betalda
 * stäms av mot Stripe (betald, rätt belopp, inte återbetald), avvikelser
 * markeras och stoppas, och först när en intern admin godkänner urvalet
 * skapas en sändning och ordrarna märks "skickad till lager". Hur sändningen
 * lämnar oss avgörs av `lib/warehouse/provider.ts`: i dag en plocklista som
 * skickas för hand, senare lagrets API, utan att flödet här ändras.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@roots/db";
import { campaigns, customerOrders, warehouseBatches } from "@roots/db/schema";
import { isDemoSession } from "../lib/session";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { acquireLock, releaseLock } from "../lib/redis-lock";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import { fulfillmentPatch, fulfillmentRefusal } from "../lib/fulfillment";
import {
  isReconciled,
  needsAcknowledgement,
  reconcileAndStore,
} from "../lib/warehouse/reconcile";
import {
  loadBulkRecipients,
  loadWarehouseOrders,
  toShipmentOrder,
} from "../lib/warehouse/orders";
import {
  buildPicklist,
  picklistToCsv,
  picklistToXlsx,
} from "../lib/warehouse/picklist";
import { getWarehouseProvider } from "../lib/warehouse/provider";

const log = childLogger("warehouse");

export const warehouseAdmin = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Varje order kostar ett anrop till Stripe, och webbens proxy väntar högst
 * 25 sekunder på ett svar. Hundra ordrar ryms med god marginal; fler än så
 * delas upp av klienten.
 */
const MAX_ORDERS_PER_REQUEST = 100;

/** Betald och ännu inte skickad från lagret. */
const OPEN_STATUSES: Array<"PAID" | "CONFIRMED"> = ["PAID", "CONFIRMED"];

/** Väntar på att gå till lagret. */
const inQueue = and(
  inArray(customerOrders.status, OPEN_STATUSES),
  isNull(customerOrders.sentToWarehouseAt)
);
/** Lämnad till lagret men inte markerad som skickad. */
const atWarehouse = and(
  inArray(customerOrders.status, OPEN_STATUSES),
  isNotNull(customerOrders.sentToWarehouseAt)
);

/** När ordern blev betald, i svensk tid. Tidsstämplarna i databasen är UTC. */
const paidMoment = sql`COALESCE(${customerOrders.paidAt}, ${customerOrders.createdAt})`;
const paidDateStockholm = sql`((${paidMoment} AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Stockholm')::date`;

/**
 * Hela ytan är stängd för demokonton, även läsningen: listorna och
 * plocklistan innehåller kunders namn, adresser och telefonnummer, och det
 * seedade demokontot har ingen tvåfaktor.
 */
async function guard(c: Context): Promise<{ session: SessionData } | Response> {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoNoWarehouseAccess") }, 403);
  }
  return { session };
}

/** Kroppen som objekt, eller null om den inte är JSON eller inte ett objekt. */
async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await c.req.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Ett riktigt datum, inte bara rätt form: 2026-02-31 finns inte. */
function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readOrderIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ORDERS_PER_REQUEST) {
    return null;
  }
  const ids = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;
    ids.add(id.toLowerCase());
  }
  return [...ids];
}

// ── GET /orders ──────────────────────────────────────────────────
warehouseAdmin.get("/orders", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  const locale = resolveUiLocale(c);

  const view = c.req.query("view") ?? "queue";
  if (view !== "queue" && view !== "sent" && view !== "all") {
    return c.json({ error: uiError(locale, "invalidFormat") }, 400);
  }
  const date = c.req.query("date") ?? "";
  if (date && !isRealDate(date)) {
    return c.json({ error: uiError(locale, "invalidFormat") }, 400);
  }
  const campaignId = c.req.query("campaignId") ?? "";
  if (campaignId && !UUID_RE.test(campaignId)) {
    return c.json({ error: uiError(locale, "invalidCampaignId") }, 400);
  }
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);

  try {
    const filters: Array<SQL | undefined> = [
      view === "queue" ? inQueue : view === "sent" ? atWarehouse : undefined,
      date ? sql`${paidDateStockholm} = ${date}::date` : undefined,
      campaignId ? eq(customerOrders.campaignId, campaignId) : undefined,
    ];
    if (q) {
      // LIKE-tecken i söktexten ska matcha sig själva.
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(
        or(
          ilike(customerOrders.customerName, pattern),
          ilike(customerOrders.customerEmail, pattern),
          sql`${customerOrders.id}::text ILIKE ${`${q.replace(/[\\%_]/g, "\\$&")}%`}`
        )
      );
    }

    const orders = await loadWarehouseOrders(and(...filters), {
      limit: 500,
      orderBy:
        view === "queue"
          ? // Säljperiodens ordrar först, sedan äldst betald först.
            [desc(customerOrders.countsTowardStats), asc(paidMoment)]
          : view === "sent"
            ? [desc(customerOrders.sentToWarehouseAt)]
            : [desc(customerOrders.createdAt)],
    });

    // Antal per flik och kampanjerna som har något i kön, för filtret.
    const [counts] = await db
      .select({
        queue: sql<number>`COUNT(*) FILTER (WHERE ${inQueue})`,
        sent: sql<number>`COUNT(*) FILTER (WHERE ${atWarehouse})`,
      })
      .from(customerOrders);
    const campaignRows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        orders: sql<number>`COUNT(*)`,
      })
      .from(customerOrders)
      .innerJoin(campaigns, eq(customerOrders.campaignId, campaigns.id))
      .where(view === "sent" ? atWarehouse : view === "all" ? undefined : inQueue)
      .groupBy(campaigns.id, campaigns.name)
      .orderBy(campaigns.name);

    return c.json({
      view,
      orders,
      counts: { queue: Number(counts?.queue ?? 0), sent: Number(counts?.sent ?? 0) },
      campaigns: campaignRows.map((r) => ({ ...r, orders: Number(r.orders) })),
    });
  } catch (err) {
    log.error({ err }, "warehouse order list failed");
    return c.json({ error: uiError(locale, "couldNotFetchOrders") }, 500);
  }
});

// ── POST /reconcile ──────────────────────────────────────────────
warehouseAdmin.post("/reconcile", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  let locale = resolveUiLocale(c);

  const body = await readBody(c);
  if (!body) return c.json({ error: uiError(locale, "invalidJson") }, 400);
  locale = resolveUiLocale(c, body.locale);
  const orderIds = readOrderIds(body.orderIds);
  if (!orderIds) return c.json({ error: uiError(locale, "warehouseSelectOrders") }, 400);

  try {
    const orders = await db
      .select()
      .from(customerOrders)
      .where(inArray(customerOrders.id, orderIds));
    const verdicts = await reconcileAndStore(orders);
    const results = orders.map((o) => ({
      orderId: o.id,
      status: verdicts.get(o.id)!.status,
      note: verdicts.get(o.id)!.note,
    }));
    return c.json({
      ok: true,
      results,
      summary: {
        checked: results.length,
        ok: results.filter((r) => isReconciled(r.status)).length,
        deviations: results.filter((r) => !isReconciled(r.status)).length,
      },
    });
  } catch (err) {
    log.error({ err }, "warehouse reconcile failed");
    return c.json({ error: uiError(locale, "warehouseReconcileFailed") }, 500);
  }
});

// ── POST /batches — godkänn urvalet och skicka till lagret ───────
warehouseAdmin.post("/batches", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  const { session } = guarded;
  let locale = resolveUiLocale(c);

  const body = await readBody(c);
  if (!body) return c.json({ error: uiError(locale, "invalidJson") }, 400);
  locale = resolveUiLocale(c, body.locale);
  const orderIds = readOrderIds(body.orderIds);
  if (!orderIds) return c.json({ error: uiError(locale, "warehouseSelectOrders") }, 400);
  const acknowledged = body.acknowledgePartlyRefunded === true;
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  // En sändning i taget. Två samtidiga godkännanden med överlappande urval
  // skulle annars båda stämma av samma order och slåss om att märka den.
  const lockKey = "warehouse:batch";
  const lock = await acquireLock(lockKey, 180);
  if (lock.status === "unavailable") {
    log.error({ err: lock.error }, "warehouse batch lock unavailable (redis)");
    return c.json({ error: uiError(locale, "warehouseBusy") }, 503);
  }
  if (lock.status === "busy") {
    return c.json({ error: uiError(locale, "warehouseBusy") }, 409);
  }

  try {
    const orders = await db
      .select()
      .from(customerOrders)
      .where(inArray(customerOrders.id, orderIds));

    type Problem = { orderId: string; status: string; note: string | null };
    const problems: Problem[] = [];
    const found = new Set(orders.map((o) => o.id));
    for (const id of orderIds) {
      if (!found.has(id)) problems.push({ orderId: id, status: "NOT_FOUND", note: null });
    }
    for (const o of orders) {
      if (o.sentToWarehouseAt) {
        problems.push({ orderId: o.id, status: "ALREADY_SENT", note: null });
      } else if (!OPEN_STATUSES.includes(o.status as "PAID" | "CONFIRMED")) {
        problems.push({ orderId: o.id, status: "NOT_OPEN", note: `Orderstatus ${o.status}` });
      }
    }

    // Avstämningen görs om här, mot Stripe, för varje order i urvalet. Ett
    // utslag från i morse räcker inte: en order kan ha återbetalats sedan
    // dess.
    const candidates = orders.filter((o) => !problems.some((p) => p.orderId === o.id));
    const verdicts = await reconcileAndStore(candidates);
    let partlyRefunded = 0;
    for (const o of candidates) {
      const verdict = verdicts.get(o.id)!;
      if (isReconciled(verdict.status)) continue;
      if (needsAcknowledgement(verdict.status)) {
        partlyRefunded += 1;
        if (acknowledged) continue;
      }
      problems.push({ orderId: o.id, status: verdict.status, note: verdict.note });
    }

    if (problems.length > 0) {
      return c.json(
        {
          error: uiError(locale, "warehouseDeviationsBlock"),
          problems,
          // Bara delåterbetalda kvar: de får gå iväg om någon tittat på dem.
          canAcknowledge: problems.every((p) => needsAcknowledgement(p.status)),
        },
        409
      );
    }

    // Lämna sändningen till lagret innan något märks hos oss. Misslyckas
    // det står ordrarna kvar i kön.
    const batchId = crypto.randomUUID();
    const detailed = await loadWarehouseOrders(inArray(customerOrders.id, orderIds));
    const bulkRecipients = await loadBulkRecipients(detailed);
    const shipmentOrders = detailed.map((o) =>
      toShipmentOrder(o, bulkRecipients.get(o.teamId))
    );
    // Saknas adress står det i plocklistan. Det stoppar inte sändningen,
    // men den som godkänner ska få veta det direkt.
    const missingAddress = shipmentOrders.filter(
      (o) => !o.addressLine1 || !o.postalCode || !o.city
    ).length;
    const provider = getWarehouseProvider();
    const { externalRef } = await provider.submit({ batchId, orders: shipmentOrders });

    const now = new Date();
    const batch = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(warehouseBatches)
        .values({
          id: batchId,
          orderCount: candidates.length,
          provider: provider.id,
          externalRef,
          note,
          createdByUserId: session.userId,
          createdAt: now,
        })
        .returning();

      for (const o of candidates) {
        const marked = await tx
          .update(customerOrders)
          .set({ sentToWarehouseAt: now, warehouseBatchId: batchId, updatedAt: now })
          .where(
            and(
              eq(customerOrders.id, o.id),
              isNull(customerOrders.sentToWarehouseAt),
              // Ordern ska vara den vi nyss stämde av: samma status och
              // samma återbetalda belopp.
              eq(customerOrders.status, o.status),
              eq(customerOrders.refundedOre, o.refundedOre)
            )
          )
          .returning({ id: customerOrders.id });
        if (marked.length !== 1) {
          throw new OrderChangedError(o.id);
        }
      }
      return created;
    });

    void auditLog({
      userId: session.userId,
      action: "warehouse.batch.created",
      entityType: "warehouse_batch",
      entityId: batch.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        number: batch.number,
        orderCount: batch.orderCount,
        provider: batch.provider,
        externalRef: batch.externalRef,
        partlyRefundedAcknowledged: acknowledged ? partlyRefunded : 0,
        missingAddress,
        orderIds: candidates.map((o) => o.id),
      },
    });

    return c.json({
      ok: true,
      batch: {
        id: batch.id,
        number: batch.number,
        orderCount: batch.orderCount,
        createdAt: batch.createdAt,
      },
      missingAddress,
    });
  } catch (err) {
    if (err instanceof OrderChangedError) {
      return c.json(
        {
          error: uiError(locale, "warehouseOrderChanged"),
          problems: [{ orderId: err.orderId, status: "CHANGED", note: null }],
        },
        409
      );
    }
    log.error({ err }, "warehouse batch creation failed");
    return c.json({ error: uiError(locale, "warehouseBatchFailed") }, 500);
  } finally {
    await releaseLock(lockKey, lock.token);
  }
});

class OrderChangedError extends Error {
  constructor(readonly orderId: string) {
    super(`order ${orderId} changed while the batch was being created`);
  }
}

// ── GET /batches ─────────────────────────────────────────────────
warehouseAdmin.get("/batches", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  try {
    const rows = await db
      .select()
      .from(warehouseBatches)
      .orderBy(desc(warehouseBatches.createdAt))
      .limit(50);
    return c.json({
      batches: rows.map((b) => ({
        id: b.id,
        number: b.number,
        orderCount: b.orderCount,
        provider: b.provider,
        note: b.note,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "warehouse batch list failed");
    return c.json({ error: uiError(resolveUiLocale(c), "couldNotFetchData") }, 500);
  }
});

// ── GET /batches/:id/picklist ────────────────────────────────────
warehouseAdmin.get("/batches/:id/picklist", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  const { session } = guarded;
  const locale = resolveUiLocale(c);

  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: uiError(locale, "invalidId") }, 400);
  const format = c.req.query("format") === "csv" ? "csv" : "xlsx";

  try {
    const [batch] = await db
      .select()
      .from(warehouseBatches)
      .where(eq(warehouseBatches.id, id))
      .limit(1);
    if (!batch) return c.json({ error: uiError(locale, "warehouseBatchNotFound") }, 404);

    const orders = await loadWarehouseOrders(eq(customerOrders.warehouseBatchId, id));
    const bulkRecipients = await loadBulkRecipients(orders);
    const picklist = buildPicklist(batch.number, orders, bulkRecipients);

    // Listan innehåller kunders namn och adresser. Vem som hämtade den, och
    // när, ska gå att se i efterhand.
    void auditLog({
      userId: session.userId,
      action: "warehouse.picklist.downloaded",
      entityType: "warehouse_batch",
      entityId: id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        number: batch.number,
        format,
        orderCount: orders.length,
      },
    });

    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(
      batch.createdAt
    );
    const filename = `Roots_plocklista_${batch.number}_${day}.${format}`;
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Cache-Control", "no-store");
    if (format === "csv") {
      c.header("Content-Type", "text/csv; charset=utf-8");
      return c.body(picklistToCsv(picklist));
    }
    c.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const buffer = await picklistToXlsx(picklist);
    return c.body(new Uint8Array(buffer));
  } catch (err) {
    log.error({ err, batchId: id }, "warehouse picklist failed");
    return c.json({ error: uiError(locale, "warehousePicklistFailed") }, 500);
  }
});

// ── POST /ship — markera skickade, i grupp ───────────────────────
//
// Samma spärrar som knappen på en enskild order (lib/fulfillment.ts): en
// stängd eller obetald order rörs inte. Dessutom flyttas bara ordrar som är
// betalda och ännu inte skickade, så en levererad order aldrig backas till
// "skickad" av en gruppmarkering.
warehouseAdmin.post("/ship", async (c) => {
  const guarded = await guard(c);
  if (guarded instanceof Response) return guarded;
  const { session } = guarded;
  let locale = resolveUiLocale(c);

  const body = await readBody(c);
  if (!body) return c.json({ error: uiError(locale, "invalidJson") }, 400);
  locale = resolveUiLocale(c, body.locale);
  const orderIds = readOrderIds(body.orderIds);
  if (!orderIds) return c.json({ error: uiError(locale, "warehouseSelectOrders") }, 400);

  try {
    const orders = await db
      .select()
      .from(customerOrders)
      .where(inArray(customerOrders.id, orderIds));

    const shipped: string[] = [];
    const skipped: Array<{ orderId: string; reason: string }> = [];
    const found = new Set(orders.map((o) => o.id));
    for (const id of orderIds) {
      if (!found.has(id)) skipped.push({ orderId: id, reason: "NOT_FOUND" });
    }

    for (const order of orders) {
      const refusal = fulfillmentRefusal(order);
      if (refusal) {
        skipped.push({ orderId: order.id, reason: refusal === "closed" ? "CLOSED" : "NOT_PAID" });
        continue;
      }
      if (!OPEN_STATUSES.includes(order.status as "PAID" | "CONFIRMED")) {
        skipped.push({ orderId: order.id, reason: "ALREADY_SHIPPED" });
        continue;
      }
      const [updated] = await db
        .update(customerOrders)
        .set(fulfillmentPatch(order, "SHIPPED"))
        .where(
          and(
            eq(customerOrders.id, order.id),
            // Optimistisk låsning: en återbetalning som hann emellan får
            // inte skrivas över med en leveransstatus.
            eq(customerOrders.status, order.status)
          )
        )
        .returning({ id: customerOrders.id });
      if (updated) shipped.push(order.id);
      else skipped.push({ orderId: order.id, reason: "CHANGED" });
    }

    if (shipped.length > 0) {
      void auditLog({
        userId: session.userId,
        action: "warehouse.orders.shipped",
        entityType: "customer_order",
        entityId: null,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          count: shipped.length,
          orderIds: shipped,
        },
      });
    }

    return c.json({ ok: true, shipped: shipped.length, skipped });
  } catch (err) {
    log.error({ err }, "warehouse group ship failed");
    return c.json({ error: uiError(locale, "couldNotMarkDelivery") }, 500);
  }
});
