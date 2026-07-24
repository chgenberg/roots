/**
 * Notifications feed — Sprint E11.
 *
 *   GET /v1/notifications
 *     Returns the 20 most-recent events relevant to the calling user,
 *     scoped by role. We don't have a dedicated `notifications` table
 *     yet — this endpoint is a *projection* over the data we already
 *     write (customer_orders, audit_logs) so we don't need a schema
 *     migration to ship the inbox UI. When we eventually persist
 *     per-user reads (mark-as-read, dismiss, etc.) the response shape
 *     here is intentionally already shaped like a notification model
 *     so the FE doesn't need to change.
 *
 *     Read-state is currently tracked client-side via localStorage —
 *     "unread" = `createdAt > lastReadAt` set by the bell dropdown.
 *
 * Scope per role (orders ≈ "X bought from your seller"):
 *   SELLER             — own customer_orders (last 30 days)
 *   TEAM_LEADER        — customer_orders for own team
 *   ASSOCIATION_ADMIN  — customer_orders for own org + team_invites used
 *   CLUB_ADMIN/MEMBER  — own org's order invoiceStatus transitions
 *   SALES_REP/ADMIN    — own assigned leads + new quotes
 *   INTERNAL_ADMIN     — high-signal audit events (logins, errors)
 */

import { Hono } from "hono";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  customerOrders,
  organizations,
  teams,
  sellers,
  auditLogs,
  teamInvites,
  orders as platformOrders,
  calculatorLinks,
  calculatorLeads,
} from "@roots/db/schema";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";

const log = childLogger("notifications");

export const notifications = new Hono();

interface NotificationItem {
  id: string; // stable per source row so the FE can dedupe
  type:
    | "ORDER_NEW"
    | "ORDER_PAID"
    | "INVOICE_PAID"
    | "INVOICE_ISSUED"
    | "TEAM_INVITE_CLAIMED"
    | "AUDIT_EVENT";
  title: string;
  body: string;
  createdAt: string;
  href?: string;
}

const LOOKBACK_DAYS = 30;
const FEED_LIMIT = 20;

function formatSek(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

notifications.get("/", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const items: NotificationItem[] = [];

  try {
    // ── SELLER feed: own customer orders ─────────────────────────
    if (session.role === "SELLER") {
      const [seller] = await db
        .select({ id: sellers.id })
        .from(sellers)
        .where(eq(sellers.userId, session.userId))
        .limit(1);
      if (seller) {
        const rows = await db
          .select()
          .from(customerOrders)
          .where(
            and(
              eq(customerOrders.sellerId, seller.id),
              gte(customerOrders.createdAt, since)
            )
          )
          .orderBy(desc(customerOrders.createdAt))
          .limit(FEED_LIMIT);
        for (const r of rows) {
          items.push({
            id: `order:${r.id}`,
            type: r.status === "PAID" ? "ORDER_PAID" : "ORDER_NEW",
            title:
              r.status === "PAID"
                ? `${r.customerName} betalade ${formatSek(r.totalOre)}`
                : `Ny beställning från ${r.customerName}`,
            body: `Status: ${r.status.toLowerCase()}`,
            createdAt: r.createdAt.toISOString(),
            href: "/min-shop/bestallningar",
          });
        }
      }
    }

    // ── TEAM_LEADER feed: team's customer orders ─────────────────
    if (session.role === "TEAM_LEADER") {
      const [team] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.leaderId, session.userId))
        .limit(1);
      if (team) {
        const rows = await db
          .select()
          .from(customerOrders)
          .where(
            and(
              eq(customerOrders.teamId, team.id),
              gte(customerOrders.createdAt, since)
            )
          )
          .orderBy(desc(customerOrders.createdAt))
          .limit(FEED_LIMIT);
        for (const r of rows) {
          items.push({
            id: `order:${r.id}`,
            type: r.status === "PAID" ? "ORDER_PAID" : "ORDER_NEW",
            title:
              r.status === "PAID"
                ? `Beställning betald: ${formatSek(r.totalOre)}`
                : `Ny beställning till laget`,
            body: `${r.customerName} (${r.status.toLowerCase()})`,
            createdAt: r.createdAt.toISOString(),
            href: "/lag/bestallningar",
          });
        }
      }
    }

    // ── ASSOCIATION_ADMIN feed: org orders + team-invite claims ──
    if (session.role === "ASSOCIATION_ADMIN" && session.orgId) {
      const orderRows = await db
        .select()
        .from(customerOrders)
        .where(
          and(
            eq(customerOrders.orgId, session.orgId),
            gte(customerOrders.createdAt, since)
          )
        )
        .orderBy(desc(customerOrders.createdAt))
        .limit(FEED_LIMIT);
      for (const r of orderRows) {
        items.push({
          id: `order:${r.id}`,
          type: r.status === "PAID" ? "ORDER_PAID" : "ORDER_NEW",
          title:
            r.status === "PAID"
              ? `Beställning betald: ${formatSek(r.totalOre)}`
              : `Ny beställning i föreningen`,
          body: `${r.customerName} (${r.status.toLowerCase()})`,
          createdAt: r.createdAt.toISOString(),
          href: "/forening",
        });
      }
      const claims = await db
        .select()
        .from(teamInvites)
        .where(
          and(
            eq(teamInvites.orgId, session.orgId),
            // Only surface claims, not pending invites — the admin
            // already has the link if it's pending.
            sql`${teamInvites.usedAt} IS NOT NULL`,
            gte(teamInvites.usedAt, since)
          )
        )
        .orderBy(desc(teamInvites.usedAt))
        .limit(10);
      for (const c of claims) {
        if (!c.usedAt) continue;
        items.push({
          id: `claim:${c.id}`,
          type: "TEAM_INVITE_CLAIMED",
          title: `Lagansvarig anslöt sig: ${c.teamName}`,
          body: "Laget är nu aktivt och kan bjuda in säljare.",
          createdAt: c.usedAt.toISOString(),
          href: "/forening/lag",
        });
      }
    }

    // ── CLUB_ADMIN/MEMBER feed: invoice state for own org ────────
    if (
      (session.role === "CLUB_ADMIN" || session.role === "CLUB_MEMBER") &&
      session.orgId
    ) {
      const rows = await db
        .select()
        .from(platformOrders)
        .where(
          and(
            eq(platformOrders.orgId, session.orgId),
            gte(platformOrders.createdAt, since),
            inArray(platformOrders.invoiceStatus, ["ISSUED", "PAID"])
          )
        )
        .orderBy(desc(platformOrders.createdAt))
        .limit(FEED_LIMIT);
      for (const r of rows) {
        items.push({
          id: `invoice:${r.id}`,
          type: r.invoiceStatus === "PAID" ? "INVOICE_PAID" : "INVOICE_ISSUED",
          title:
            r.invoiceStatus === "PAID"
              ? `Faktura betald: ${formatSek(r.totalOre)}`
              : `Faktura skickad: ${formatSek(r.totalOre)}`,
          body: r.fortnoxInvoiceId
            ? `Fortnox-fakt. #${r.fortnoxInvoiceId}`
            : `Order #${r.id.slice(0, 8)}`,
          createdAt: r.createdAt.toISOString(),
          href: "/portal/fakturor",
        });
      }
    }

    // ── SALES_REP feed: own assigned leads + lead-created audits ─
    if (session.role === "SALES_REP" || session.role === "SALES_ADMIN") {
      const leadRows = await db
        .select()
        .from(organizations)
        .where(
          and(
            or(
              eq(organizations.assignedAsmUserId, session.userId),
              eq(organizations.crmStatus, "LEAD") // SALES_ADMIN sees all
            )!,
            gte(organizations.createdAt, since)
          )
        )
        .orderBy(desc(organizations.createdAt))
        .limit(FEED_LIMIT);
      for (const r of leadRows) {
        if (
          session.role === "SALES_REP" &&
          r.assignedAsmUserId !== session.userId
        ) {
          continue;
        }
        items.push({
          id: `lead:${r.id}`,
          type: "AUDIT_EVENT",
          title: `Nytt lead: ${r.name}`,
          body: r.leadSource
            ? `Källa: ${r.leadSource.toLowerCase()}`
            : "Inkommande prospekt",
          createdAt: r.createdAt.toISOString(),
          href: "/portal/pipeline",
        });
      }

      // Föreningskalkylator: leads från säljarens egna delade länkar.
      // SALES_ADMIN ser alla; SALES_REP bara sina egna länkar.
      const leadRows2 = await db
        .select({
          id: calculatorLeads.id,
          email: calculatorLeads.email,
          contactName: calculatorLeads.contactName,
          associationName: calculatorLinks.associationName,
          createdByUserId: calculatorLinks.createdByUserId,
          createdAt: calculatorLeads.createdAt,
        })
        .from(calculatorLeads)
        .innerJoin(
          calculatorLinks,
          eq(calculatorLeads.calculatorLinkId, calculatorLinks.id)
        )
        .where(gte(calculatorLeads.createdAt, since))
        .orderBy(desc(calculatorLeads.createdAt))
        .limit(FEED_LIMIT);
      for (const r of leadRows2) {
        // Leads från den öppna webbkalkylatorn hör inte till någon enskild
        // säljare (sentinel-länk) → visa dem för alla sälj-roller, inte bara
        // länkägaren. Övriga leads filtreras per ägare för SALES_REP.
        const isPublicWeb = r.associationName === "Öppen kalkylator (webbplatsen)";
        if (
          !isPublicWeb &&
          session.role === "SALES_REP" &&
          r.createdByUserId !== session.userId
        ) {
          continue;
        }
        items.push({
          id: `calc-lead:${r.id}`,
          type: "AUDIT_EVENT",
          title: isPublicWeb
            ? "Ny lead från webbkalkylatorn"
            : `Ny kalkyl-lead: ${r.associationName}`,
          body: r.contactName ? `${r.contactName} · ${r.email}` : r.email,
          createdAt: r.createdAt.toISOString(),
          href: "/portal/raknesnurra",
        });
      }
    }

    // ── INTERNAL_ADMIN feed: high-signal audit events ────────────
    if (session.role === "INTERNAL_ADMIN") {
      const highSignal = [
        "auth.login.failed",
        "auth.change_password.ok",
        "association.team_invite.claimed",
        "sales.lead.created",
        "association.campaign.created",
      ];
      const rows = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            inArray(auditLogs.action, highSignal),
            gte(auditLogs.createdAt, since)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(FEED_LIMIT);
      for (const r of rows) {
        items.push({
          id: `audit:${r.id}`,
          type: "AUDIT_EVENT",
          title: r.action,
          body: r.entityType ? `${r.entityType} ${r.entityId ?? ""}`.trim() : "",
          createdAt: r.createdAt.toISOString(),
          href: "/portal/audit-log",
        });
      }
    }

    // Stable sort newest-first across all sources, then cap.
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const trimmed = items.slice(0, FEED_LIMIT);

    return c.json({
      items: trimmed,
      // The "as-of" timestamp lets the FE compute unread counts
      // deterministically against the localStorage `lastReadAt`.
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    log.error({ err, role: session.role }, "notifications fetch failed");
    return c.json({ error: "Kunde inte hämta aviseringar" }, 500);
  }
});
