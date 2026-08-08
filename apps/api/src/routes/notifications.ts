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
import {
  resolveUiLocale,
  uiError,
  type UiLocale,
} from "../lib/ui-locale";

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

const ORDER_STATUS_LABEL: Record<
  UiLocale,
  Record<string, string>
> = {
  sv: {
    draft: "Utkast",
    pending: "Väntar på betalning",
    paid: "Betald",
    confirmed: "Bekräftad",
    shipped: "Skickad",
    delivered: "Levererad",
    cancelled: "Avbruten",
    refunded: "Återbetald",
    failed: "Misslyckad",
  },
  en: {
    draft: "Draft",
    pending: "Awaiting payment",
    paid: "Paid",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    failed: "Failed",
  },
};

function orderStatusLabel(status: string, locale: UiLocale): string {
  const key = status.toLowerCase();
  return ORDER_STATUS_LABEL[locale][key] ?? status;
}

const NOTIF_COPY = {
  sv: {
    fetchFailed: "Kunde inte hämta aviseringar",
    sellerPaid: (name: string, amount: string) =>
      `${name} betalade ${amount}`,
    sellerNew: (name: string) => `Ny beställning från ${name}`,
    status: (status: string) => `Status: ${orderStatusLabel(status, "sv")}`,
    teamPaid: (amount: string) => `Beställning betald: ${amount}`,
    teamNew: "Ny beställning till laget",
    customerStatus: (name: string, status: string) =>
      `${name} (${orderStatusLabel(status, "sv")})`,
    orgPaid: (amount: string) => `Beställning betald: ${amount}`,
    orgNew: "Ny beställning i föreningen",
    teamClaimed: (teamName: string) =>
      `Lagansvarig anslöt sig: ${teamName}`,
    teamClaimedBody: "Laget är nu aktivt och kan bjuda in säljare.",
    invoicePaid: (amount: string) => `Faktura betald: ${amount}`,
    invoiceIssued: (amount: string) => `Faktura skickad: ${amount}`,
    fortnoxInvoice: (id: string) => `Fortnox-fakt. #${id}`,
    orderShort: (id: string) => `Order #${id}`,
    newLead: (name: string) => `Nytt lead: ${name}`,
    leadSource: (source: string) => `Källa: ${source}`,
    incomingProspect: "Inkommande prospekt",
    calcLeadPublic: "Ny lead från webbkalkylatorn",
    calcLead: (name: string) => `Ny kalkyl-lead: ${name}`,
    publicWebAssociation: "Öppen kalkylator (webbplatsen)",
  },
  en: {
    fetchFailed: "Could not fetch notifications",
    sellerPaid: (name: string, amount: string) =>
      `${name} paid ${amount}`,
    sellerNew: (name: string) => `New order from ${name}`,
    status: (status: string) => `Status: ${orderStatusLabel(status, "en")}`,
    teamPaid: (amount: string) => `Order paid: ${amount}`,
    teamNew: "New order for the team",
    customerStatus: (name: string, status: string) =>
      `${name} (${orderStatusLabel(status, "en")})`,
    orgPaid: (amount: string) => `Order paid: ${amount}`,
    orgNew: "New order in the club",
    teamClaimed: (teamName: string) =>
      `Team leader joined: ${teamName}`,
    teamClaimedBody: "The team is now active and can invite sellers.",
    invoicePaid: (amount: string) => `Invoice paid: ${amount}`,
    invoiceIssued: (amount: string) => `Invoice sent: ${amount}`,
    fortnoxInvoice: (id: string) => `Fortnox inv. #${id}`,
    orderShort: (id: string) => `Order #${id}`,
    newLead: (name: string) => `New lead: ${name}`,
    leadSource: (source: string) => `Source: ${source}`,
    incomingProspect: "Incoming prospect",
    calcLeadPublic: "New lead from the web calculator",
    calcLead: (name: string) => `New calculator lead: ${name}`,
    publicWebAssociation: "Open calculator (website)",
  },
} as const;

function formatSek(ore: number, locale: UiLocale): string {
  const amount = Math.round(ore / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE"
  );
  return locale === "en" ? `${amount} SEK` : `${amount} kr`;
}

notifications.get("/", async (c) => {
  const locale = resolveUiLocale(c);
  const t = NOTIF_COPY[locale];

  const session = await requireSession(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

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
                ? t.sellerPaid(r.customerName, formatSek(r.totalOre, locale))
                : t.sellerNew(r.customerName),
            body: t.status(r.status.toLowerCase()),
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
                ? t.teamPaid(formatSek(r.totalOre, locale))
                : t.teamNew,
            body: t.customerStatus(r.customerName, r.status.toLowerCase()),
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
              ? t.orgPaid(formatSek(r.totalOre, locale))
              : t.orgNew,
          body: t.customerStatus(r.customerName, r.status.toLowerCase()),
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
      for (const claim of claims) {
        if (!claim.usedAt) continue;
        items.push({
          id: `claim:${claim.id}`,
          type: "TEAM_INVITE_CLAIMED",
          title: t.teamClaimed(claim.teamName),
          body: t.teamClaimedBody,
          createdAt: claim.usedAt.toISOString(),
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
              ? t.invoicePaid(formatSek(r.totalOre, locale))
              : t.invoiceIssued(formatSek(r.totalOre, locale)),
          body: r.fortnoxInvoiceId
            ? t.fortnoxInvoice(r.fortnoxInvoiceId)
            : t.orderShort(r.id.slice(0, 8)),
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
          title: t.newLead(r.name),
          body: r.leadSource
            ? t.leadSource(r.leadSource.toLowerCase())
            : t.incomingProspect,
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
        // Match stored Swedish sentinel name regardless of UI locale.
        const isPublicWeb =
          r.associationName === NOTIF_COPY.sv.publicWebAssociation;
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
            ? t.calcLeadPublic
            : t.calcLead(r.associationName),
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
    return c.json({ error: t.fetchFailed }, 500);
  }
});
