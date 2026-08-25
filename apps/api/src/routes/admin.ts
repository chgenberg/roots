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
import { and, asc, desc, eq, gte, inArray, like, lt, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@roots/db";
import { auditLogs, users, organizations, reviewerThreads, reviewerMessages } from "@roots/db/schema";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { resolveUiLocale, uiError } from "../lib/ui-locale";

const log = childLogger("admin");

export const admin = new Hono();

type GuardResult =
  | { ok: true; session: SessionData }
  | { ok: false; status: 401 | 403; error: string };

async function requireInternalAdmin(c: Context): Promise<GuardResult> {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return { ok: false, status: 401, error: uiError(locale, "notLoggedIn") };
  if (session.role !== "INTERNAL_ADMIN") {
    return { ok: false, status: 403, error: uiError(locale, "permissionDenied") };
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
    return c.json({ error: uiError(resolveUiLocale(c), "couldNotFetchAuditLog") }, 500);
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
    return c.json({ error: uiError(resolveUiLocale(c), "couldNotFetchActionList") }, 500);
  }
});

/**
 * ── Godkännande av självregistrerade föreningar ──────────────────────
 *
 * En förening som registrerar sig själv får ASSOCIATION_ADMIN direkt, men
 * kan inte ta emot publika betalningar förrän någon hos oss tittat på
 * uppgifterna. Se apps/api/src/lib/org-approval.ts för varför.
 *
 *   GET  /v1/admin/organizations/pending
 *   POST /v1/admin/organizations/:orgId/approve   { approved?: boolean }
 */

admin.get("/organizations/pending", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  try {
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        orgNumber: organizations.orgNumber,
        nationalFederation: organizations.nationalFederation,
        sportType: organizations.sportType,
        createdAt: organizations.createdAt,
        // Alla kontaktpersoner samlade på föreningens rad.
        //
        // Joinen gav tidigare en rad per administratör, så en förening med två
        // admins dök upp två gånger och `limit(200)` räknade joinade rader i
        // stället för föreningar — med tillräckligt många dubbletter kunde en
        // förening som väntar på granskning falla utanför listan helt och
        // därmed aldrig bli godkänd.
        contacts: sql<
          Array<{ email: string; name: string | null; phone: string | null }>
        >`coalesce(
            jsonb_agg(
              distinct jsonb_build_object(
                'email', ${users.email},
                'name', ${users.contactName},
                'phone', ${users.phone}
              )
            ) filter (where ${users.email} is not null),
            '[]'::jsonb
          )`,
      })
      .from(organizations)
      // Kontaktpersonen är det granskaren faktiskt behöver — namnet på
      // föreningen säger ingenting om vem som skrev in det.
      .leftJoin(
        users,
        and(eq(users.orgId, organizations.id), eq(users.role, "ASSOCIATION_ADMIN"))
      )
      .where(eq(organizations.verified, false))
      // Föreningens id är primärnyckel, så Postgres tillåter att de övriga
      // kolumnerna väljs utan att räknas upp här.
      .groupBy(organizations.id)
      .orderBy(desc(organizations.createdAt))
      .limit(200);

    return c.json({ organizations: rows });
  } catch (err) {
    log.error({ err }, "pending organizations failed");
    return c.json({ error: uiError(resolveUiLocale(c), "couldNotFetchOrgsToReview") }, 500);
  }
});

admin.post("/organizations/:orgId/approve", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const locale = resolveUiLocale(c);
  const orgId = c.req.param("orgId");
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
    return c.json({ error: uiError(locale, "invalidOrgId") }, 400);
  }

  let body: { approved?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // Tom body betyder godkänn — det är det vanliga fallet.
  }
  const approved = body.approved !== false;

  try {
    const [updated] = await db
      .update(organizations)
      .set({
        verified: approved,
        verifiedAt: approved ? new Date() : null,
        verifiedByUserId: approved ? guard.session.userId : null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    if (!updated) {
      return c.json({ error: uiError(locale, "associationNotFoundPeriod") }, 404);
    }

    void auditLog({
      userId: guard.session.userId,
      action: approved
        ? "admin.organization.approved"
        : "admin.organization.approval_revoked",
      entityType: "organization",
      entityId: orgId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgName: updated.name,
      },
    });

    return c.json({
      ok: true,
      organization: {
        id: updated.id,
        name: updated.name,
        verified: updated.verified,
        verifiedAt: updated.verifiedAt,
      },
    });
  } catch (err) {
    log.error({ err, orgId }, "organization approval failed");
    return c.json({ error: uiError(locale, "couldNotUpdateAssociation") }, 500);
  }
});

function parseReviewerUrls(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

admin.get("/feedback", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const threads = await db
    .select()
    .from(reviewerThreads)
    .where(inArray(reviewerThreads.status, ["submitted", "done"]))
    .orderBy(desc(reviewerThreads.updatedAt));

  const threadIds = threads.map((t) => t.id);
  const userIds = [...new Set(threads.map((t) => t.userId))];
  const messages =
    threadIds.length === 0
      ? []
      : await db
          .select()
          .from(reviewerMessages)
          .where(inArray(reviewerMessages.threadId, threadIds))
          .orderBy(asc(reviewerMessages.createdAt));
  const authors =
    userIds.length === 0
      ? []
      : await db
          .select({
            id: users.id,
            email: users.email,
            contactName: users.contactName,
          })
          .from(users)
          .where(inArray(users.id, userIds));
  const authorById = new Map(authors.map((u) => [u.id, u]));
  const messagesByThread = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = messagesByThread.get(m.threadId) ?? [];
    list.push(m);
    messagesByThread.set(m.threadId, list);
  }

  return c.json({
    threads: threads.map((t) => {
      const author = authorById.get(t.userId);
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        cursorPrompt: t.cursorPrompt,
        updatedAt: t.updatedAt.toISOString(),
        fromName: author?.contactName || author?.email || "Feedback",
        messages: (messagesByThread.get(t.id) ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          body: m.body,
          imageUrls: parseReviewerUrls(m.imageUrls),
        })),
      };
    }),
  });
});

admin.patch("/feedback", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const body = (await c.req.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return c.json({ error: "MISSING_ID" }, 400);
  if (body?.action !== "done" && body?.action !== "submitted") {
    return c.json({ error: "INVALID_ACTION" }, 400);
  }

  const updated = await db
    .update(reviewerThreads)
    .set({ status: body.action, updatedAt: new Date() })
    .where(
      and(
        eq(reviewerThreads.id, id),
        inArray(reviewerThreads.status, ["submitted", "done"])
      )
    )
    .returning({ id: reviewerThreads.id });
  if (updated.length === 0) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

// keep `lte`/`requireInternalAdmin`-helpers from being tree-shaken if
// future endpoints want them.
export const _unused = { lte };
