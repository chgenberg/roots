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
import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations, users } from "@roots/db/schema";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import type { SessionData } from "../lib/session";
import { auditLog, requestContext } from "../lib/audit";
import { childLogger } from "../lib/logger";

const log = childLogger("sales");

export const sales = new Hono();

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

// users export kept for future endpoints (resolve assigned-rep name etc.)
export const _unused = users;
