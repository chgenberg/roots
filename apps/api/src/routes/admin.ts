/**
 * INTERNAL_ADMIN endpoints — Sprint E11.
 *
 *   GET /v1/admin/audit-log
 *     List audit events with optional filters (action prefix,
 *     entityType, userId, date range) and cursor-based pagination.
 *     Restricted to role=INTERNAL_ADMIN — these events include things
 *     like password changes and CSRF rejections, which we must not
 *     leak to other roles.
 *
 *   GET /v1/admin/audit-log/actions
 *     Distinct action strings currently in the log, used to populate
 *     the filter dropdown in the UI.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { and, desc, eq, gte, like, lt, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@roots/db";
import { auditLogs, users } from "@roots/db/schema";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";

const log = childLogger("admin");

export const admin = new Hono();

type GuardResult =
  | { ok: true; session: SessionData }
  | { ok: false; status: 401 | 403; error: string };

async function requireInternalAdmin(c: Context): Promise<GuardResult> {
  const session = await requireSession(c);
  if (!session) return { ok: false, status: 401, error: "Ej inloggad" };
  if (session.role !== "INTERNAL_ADMIN") {
    return { ok: false, status: 403, error: "Behörighet saknas" };
  }
  return { ok: true, session };
}

// ── GET /audit-log ───────────────────────────────────────────────
admin.get("/audit-log", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const q = c.req.query();
  const actionPrefix = (q.action ?? "").trim().slice(0, 100);
  const entityType = (q.entityType ?? "").trim().slice(0, 50);
  const userIdQ = (q.userId ?? "").trim();
  const fromDate = (q.from ?? "").trim();
  const toDate = (q.to ?? "").trim();
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const offset = Math.max(0, Number.parseInt(q.offset ?? "0", 10) || 0);

  // Build the WHERE clause incrementally. Each filter is optional;
  // we only apply a clause when the value is non-empty + valid.
  const clauses: SQL[] = [];
  if (actionPrefix) {
    clauses.push(like(auditLogs.action, `${actionPrefix}%`));
  }
  if (entityType) {
    clauses.push(eq(auditLogs.entityType, entityType));
  }
  if (userIdQ && /^[0-9a-f-]{36}$/i.test(userIdQ)) {
    clauses.push(eq(auditLogs.userId, userIdQ));
  }
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    clauses.push(gte(auditLogs.createdAt, new Date(`${fromDate}T00:00:00Z`)));
  }
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    const next = new Date(`${toDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    clauses.push(lt(auditLogs.createdAt, next));
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  try {
    // Fetch one extra row so the UI can decide whether a "next page"
    // link makes sense without a second count query.
    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditLogs)
      .where(where);

    return c.json({
      items: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        meta: r.meta,
        createdAt: r.createdAt.toISOString(),
      })),
      total: Number(count) || 0,
      limit,
      offset,
      hasMore,
    });
  } catch (err) {
    log.error({ err }, "audit-log list failed");
    return c.json({ error: "Kunde inte hämta audit-log" }, 500);
  }
});

// ── GET /audit-log/actions ───────────────────────────────────────
admin.get("/audit-log/actions", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  try {
    // Top-1000 distinct actions, recent first via MAX(createdAt) so
    // active actions float to the top of the dropdown.
    const rows = await db
      .select({
        action: auditLogs.action,
        lastSeen: sql<Date>`MAX(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`MAX(${auditLogs.createdAt})`))
      .limit(200);

    return c.json({
      actions: rows.map((r) => ({
        action: r.action,
        lastSeen: r.lastSeen?.toISOString?.() ?? null,
        count: Number(r.count) || 0,
      })),
    });
  } catch (err) {
    log.error({ err }, "audit-log actions failed");
    return c.json({ error: "Kunde inte hämta åtgärds-lista" }, 500);
  }
});

// keep `lte`/`requireInternalAdmin`-helpers from being tree-shaken if
// future endpoints want them.
export const _unused = { lte };
