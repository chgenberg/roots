/**
 * Sales-portal endpoints — Sprint E9.
 *
 * Surfaces the "create new lead" action for SALES_REP and INTERNAL_ADMIN
 * roles. Documented as P1 gap in `docs/ROLE_GAP_AUDIT.md`.
 *
 *   POST /v1/sales/leads — create a new prospect (organizations row
 *                           with crm_status='LEAD')
 *
 * A "lead" in Roots is just an `organizations` row whose `crm_status`
 * column is set to 'LEAD'. Real customers move to 'CUSTOMER' once they
 * accept a quote. Keeping it on the canonical org table means the
 * existing /portal/klubbar list, quotes, and Fortnox sync all work
 * unchanged — leads simply show up with a different badge.
 */

import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@roots/db";
import {
  organizations,
  users,
  campaigns,
  customerOrders,
} from "@roots/db/schema";
import { isDemoSession } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { auditLog, requestContext } from "../lib/audit";
import { childLogger } from "../lib/logger";

const log = childLogger("sales");

export const sales = new Hono();

// ── POST /leads ──────────────────────────────────────────────────
sales.post("/leads", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (
    session.role !== "SALES_REP" &&
    session.role !== "SALES_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  // MASTERPLAN_01 KC2.1: demo-säljare ska kunna utforska pipeline-UI:t
  // men inte skapa riktiga prospects som blir kvar i Roots CRM efter
  // demo-sessionen är slut.
  if (isDemoSession(session)) {
    return c.json(
      { error: "Demoläget kan inte skapa riktiga prospects." },
      403
    );
  }

  type Body = {
    name?: string;
    leadSource?: string;
    potentialScore?: number;
    municipality?: string;
    website?: string;
    orgNumber?: string;
    notes?: string; // accepted but not stored — keeps payload future-proof
  };

  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length < 2 || name.length > 255) {
    return c.json({ error: "Klubbnamn måste vara 2–255 tecken." }, 400);
  }

  const leadSource = body.leadSource?.trim().toUpperCase() || null;
  const allowedSources = new Set([
    "MANUAL",
    "INBOUND",
    "EVENT",
    "REFERRAL",
    "OUTBOUND",
    "WEB",
  ]);
  if (leadSource && !allowedSources.has(leadSource)) {
    return c.json(
      { error: "Ogiltig lead-källa. Tillåtna: " + [...allowedSources].join(", ") },
      400
    );
  }

  let potentialScore: number | null = null;
  if (body.potentialScore !== undefined && body.potentialScore !== null) {
    const n = Math.floor(body.potentialScore);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return c.json({ error: "potentialScore måste vara 0–100." }, 400);
    }
    potentialScore = n;
  }

  const orgNumber = body.orgNumber?.trim().replace(/\s+/g, "") || null;
  if (orgNumber && !/^\d{6,12}-?\d{4}$/.test(orgNumber)) {
    return c.json({ error: "Ogiltigt organisationsnummer." }, 400);
  }

  const municipality = body.municipality?.trim() || null;
  const website = body.website?.trim() || null;

  try {
    if (orgNumber) {
      const [existing] = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.orgNumber, orgNumber))
        .limit(1);
      if (existing) {
        return c.json(
          {
            error: "Organisationsnumret finns redan.",
            existingOrgId: existing.id,
            existingOrgName: existing.name,
          },
          409
        );
      }
    }

    const [lead] = await db
      .insert(organizations)
      .values({
        name,
        type: "club",
        orgNumber,
        crmStatus: "LEAD",
        leadSource,
        potentialScore,
        municipality,
        website,
        assignedAsmUserId: session.userId,
      })
      .returning();

    void auditLog({
      userId: session.userId,
      action: "sales.lead.created",
      entityType: "organization",
      entityId: lead.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        leadSource,
        potentialScore,
      },
    });

    return c.json(
      {
        id: lead.id,
        name: lead.name,
        crmStatus: lead.crmStatus,
        leadSource: lead.leadSource,
        potentialScore: lead.potentialScore,
        assignedAsmUserId: lead.assignedAsmUserId,
      },
      201
    );
  } catch (err) {
    log.error({ err }, "lead create failed");
    return c.json({ error: "Kunde inte skapa lead just nu." }, 500);
  }
});

/**
 * MASTERPLAN_02: säljaktivitets-/leveranskalender över alla föreningar.
 *
 * GET /v1/sales/calendar
 *   Returnerar alla kampanjer (säljperioder) med förening, start/slut och
 *   leveransdatum till klubben, plus betald försäljning. Ger sälj/intern
 *   en överblick av "när har respektive förening sina säljaktiviteter och
 *   när skickas produkterna till klubben".
 *
 * Behörighet: SALES_REP / SALES_ADMIN / INTERNAL_ADMIN.
 */
sales.get("/calendar", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (
    session.role !== "SALES_REP" &&
    session.role !== "SALES_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        startDate: campaigns.startDate,
        endDate: campaigns.endDate,
        deliveryDate: campaigns.deliveryDate,
        deliveryType: campaigns.deliveryType,
        orgId: campaigns.orgId,
        orgName: organizations.name,
      })
      .from(campaigns)
      .innerJoin(organizations, eq(campaigns.orgId, organizations.id))
      .orderBy(campaigns.startDate);

    // Betald försäljning per kampanj (inom period) i ett svep.
    const campaignIds = rows.map((r) => r.id);
    const salesMap = new Map<string, { total: number; orders: number }>();
    if (campaignIds.length > 0) {
      const salesRows = await db
        .select({
          campaignId: customerOrders.campaignId,
          total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
          orders: sql<number>`COUNT(*)`,
        })
        .from(customerOrders)
        .where(
          and(
            inArray(customerOrders.campaignId, campaignIds),
            eq(customerOrders.status, "PAID"),
            eq(customerOrders.countsTowardStats, true)
          )
        )
        .groupBy(customerOrders.campaignId);
      for (const s of salesRows) {
        salesMap.set(s.campaignId, {
          total: Number(s.total),
          orders: Number(s.orders),
        });
      }
    }

    return c.json({
      campaigns: rows.map((r) => ({
        ...r,
        totalSalesOre: salesMap.get(r.id)?.total ?? 0,
        orderCount: salesMap.get(r.id)?.orders ?? 0,
      })),
    });
  } catch (err) {
    log.error({ err }, "sales calendar failed");
    return c.json({ error: "Kunde inte hämta kalendern." }, 500);
  }
});

// users export kept for future endpoints (resolve assigned-rep name etc.)
export const _unused = users;
