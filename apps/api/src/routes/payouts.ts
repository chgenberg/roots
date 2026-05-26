/**
 * MASTERPLAN_01 KC1.5 — payout lifecycle endpoints.
 *
 * Tidigare hade plattformen en `payouts.status`-enum (PENDING →
 * INVOICED → PAID) men ingen kod satte den till PAID. Föreningar
 * ringde "var är våra pengar?" och INTERNAL_ADMIN saknade en knapp.
 *
 * Den här filen är hela utbetalnings-livscykeln vid sidan av
 * `settlement.ts`:
 *   - GET    /v1/payouts                       — listing (admin)
 *   - GET    /v1/payouts/mine                  — assoc-admin (egna)
 *   - PATCH  /v1/payouts/:id/status            — INVOICED|PAID
 *
 * När en payout markeras PAID:
 *   1. Skriver paidAt + paymentReference + paidByUserId till DB
 *      (paidAt-kolumnen lades i migration 0008).
 *   2. Emiter audit `payout.paid` (KC8.4) med belopp + reference.
 *   3. Skickar e-post till primär ASSOCIATION_ADMIN (fire-and-forget).
 *   4. Endast INTERNAL_ADMIN får sätta PAID i prod. ASSOCIATION_ADMIN
 *      kan se men inte mutera.
 *
 * "Riktigt Klarna/Fortnox saknas än"-mode: PATCH-pathen fungerar
 * helt utan externa providers — bokföringen kan flagga PAID manuellt
 * efter att SEB-transaktionen har synts. När Fortnox-webhooken
 * kopplas på senare (se docs/runbooks/onboard-fortnox.md) kan den
 * anropa samma endpoint via en interna service-token.
 */

import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@roots/db";
import {
  payouts,
  campaigns,
  organizations,
  users,
} from "@roots/db/schema";
import {
  getSession,
  isDemoSession,
  SESSION_COOKIE_NAME,
  type SessionData,
} from "../lib/session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { getEmailSender } from "../lib/email";
import { payoutPaidEmail } from "../lib/email/templates";

const log = childLogger("payouts");

export const payoutsRoute = new Hono();

// P2.26 (audit 2026-05-26): tidigare fallback:ade alla länkar till
// http://localhost om varken NEXT_PUBLIC_SITE_URL eller SITE_URL var
// satta — i prod betydde det att email-länkar kunde bli "click here
// to view: http://localhost:3003/...". Fall tillbaka på roots.se.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://roots.se"
    : "http://localhost:3003")
).replace(/\/$/, "");

// Lokal helper-pattern matchar dashboard.ts/settlement.ts — vi exporterar
// inte en delad `requireSession` ännu (skulle vara en egen story att
// rycka ut till en lib).
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

// ────────────────────────────────────────────────────────────────────
// GET /v1/payouts (INTERNAL_ADMIN only — alla utbetalningar i systemet)
// ────────────────────────────────────────────────────────────────────
payoutsRoute.get("/", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    const rows = await db
      .select({
        id: payouts.id,
        campaignId: payouts.campaignId,
        orgId: payouts.orgId,
        teamId: payouts.teamId,
        totalSalesOre: payouts.totalSalesOre,
        rootsShareOre: payouts.rootsShareOre,
        teamShareOre: payouts.teamShareOre,
        status: payouts.status,
        fortnoxInvoiceId: payouts.fortnoxInvoiceId,
        createdAt: payouts.createdAt,
        updatedAt: payouts.updatedAt,
      })
      .from(payouts)
      .orderBy(desc(payouts.createdAt))
      .limit(200);

    return c.json({ payouts: rows });
  } catch (err) {
    log.error({ err }, "list payouts failed");
    return c.json({ error: "Kunde inte hämta utbetalningar." }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /v1/payouts/mine (ASSOCIATION_ADMIN — för egna org:en)
// ────────────────────────────────────────────────────────────────────
payoutsRoute.get("/mine", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (!session.orgId) {
    return c.json({ error: "Ingen organisation kopplad till sessionen." }, 422);
  }

  try {
    const rows = await db
      .select({
        id: payouts.id,
        campaignId: payouts.campaignId,
        teamId: payouts.teamId,
        totalSalesOre: payouts.totalSalesOre,
        teamShareOre: payouts.teamShareOre,
        status: payouts.status,
        fortnoxInvoiceId: payouts.fortnoxInvoiceId,
        createdAt: payouts.createdAt,
        updatedAt: payouts.updatedAt,
      })
      .from(payouts)
      .where(eq(payouts.orgId, session.orgId))
      .orderBy(desc(payouts.createdAt));

    return c.json({ payouts: rows });
  } catch (err) {
    log.error({ err }, "list mine payouts failed");
    return c.json({ error: "Kunde inte hämta utbetalningar." }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────
// PATCH /v1/payouts/:id/status
// ────────────────────────────────────────────────────────────────────

const ALLOWED_TARGET_STATUSES = ["INVOICED", "PAID"] as const;
type TargetStatus = (typeof ALLOWED_TARGET_STATUSES)[number];

payoutsRoute.patch("/:id/status", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  // Strikt admin-only. ASSOCIATION_ADMIN får inte själv flippa PAID
  // (skulle göra det enkelt att kvittera utan att Roots transferade).
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (isDemoSession(session)) {
    return c.json(
      { error: "Demoläget kan inte ändra riktiga utbetalningar." },
      403
    );
  }

  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ error: "Ogiltigt ID." }, 400);
  }

  let body: { status?: TargetStatus; paymentReference?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON." }, 400);
  }

  const targetStatus = body.status;
  if (!targetStatus || !ALLOWED_TARGET_STATUSES.includes(targetStatus)) {
    return c.json(
      {
        error: `status måste vara en av: ${ALLOWED_TARGET_STATUSES.join(", ")}`,
      },
      400
    );
  }

  const paymentReference = body.paymentReference?.trim() || null;
  if (paymentReference && paymentReference.length > 64) {
    return c.json({ error: "Referens får vara max 64 tecken." }, 400);
  }

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);

    if (!payout) {
      return c.json({ error: "Utbetalning hittades inte." }, 404);
    }

    // State-machine gates: kan bara gå PENDING→INVOICED och
    // {PENDING,INVOICED}→PAID. PAID är terminal — kräver manuell
    // DB-fix för att rolla tillbaka (medveten friction så ops
    // inte oavsiktligt "ångrar" en betalning utan postmortem).
    if (targetStatus === "INVOICED" && payout.status !== "PENDING") {
      return c.json(
        {
          error: `Kan bara markera INVOICED från PENDING (är: ${payout.status}).`,
        },
        409
      );
    }
    if (targetStatus === "PAID" && payout.status === "PAID") {
      return c.json(
        {
          ok: true,
          alreadyPaid: true,
          status: "PAID",
        },
        200
      );
    }
    // P2.16 (audit 2026-05-26): tidigare tilläts PENDING→PAID rakt
    // av om man hade rätt RBAC, vilket bypass:ade INVOICED-stegets
    // syfte: 1) ingen Fortnox-faktura är skapad (= ingen MOMS
    // rapporterad), 2) ingen extern referens. Tvinga vägen
    // PENDING → INVOICED → PAID så ASSOCIATION_ADMIN-mailet
    // ("din faktura är betald") alltid följer en faktiskt utfärdad
    // faktura.
    if (targetStatus === "PAID" && payout.status !== "INVOICED") {
      return c.json(
        {
          error: `Utbetalning måste vara INVOICED innan den kan markeras PAID (är: ${payout.status}).`,
        },
        409
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(payouts)
      .set({
        status: targetStatus,
        // paidAt + paidByUserId + paymentReference finns i schema-
        // migrationen 0008. Vi sätter dem ENDAST när targetStatus=PAID
        // så vi behåller invoiced-historik orörd.
        ...(targetStatus === "PAID"
          ? {
              paidAt: now,
              paidByUserId: session.userId,
              paymentReference,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(payouts.id, id))
      .returning();

    // ── Audit ────────────────────────────────────────────────────
    void auditLog({
      userId: session.userId,
      action: targetStatus === "PAID" ? "payout.paid" : "payout.invoiced",
      entityType: "payout",
      entityId: id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: payout.orgId,
        campaignId: payout.campaignId,
        amountOre: payout.teamShareOre,
        rootsShareOre: payout.rootsShareOre,
        paymentReference,
        previousStatus: payout.status,
      },
    });

    // ── Email vid PAID (fire-and-forget) ─────────────────────────
    if (targetStatus === "PAID") {
      void (async () => {
        try {
          // P3.32 (audit 2026-05-26): exkludera GDPR-tombstones så
          // payment-notifieringar inte hamnar i en anonymiserad inbox.
          const [admin] = await db
            .select({
              email: users.email,
              contactName: users.contactName,
            })
            .from(users)
            .where(
              and(
                eq(users.orgId, payout.orgId),
                eq(users.role, "ASSOCIATION_ADMIN"),
                isNull(users.deletedAt)
              )
            )
            .limit(1);
          if (!admin?.email) {
            log.warn(
              { payoutId: id, orgId: payout.orgId },
              "payout.paid email skipped — no assoc-admin"
            );
            return;
          }

          const [org] = await db
            .select({
              name: organizations.name,
              displayName: organizations.displayName,
            })
            .from(organizations)
            .where(eq(organizations.id, payout.orgId))
            .limit(1);

          const [campaign] = await db
            .select({ name: campaigns.name })
            .from(campaigns)
            .where(eq(campaigns.id, payout.campaignId))
            .limit(1);

          await getEmailSender().sendEmail({
            to: admin.email,
            ...payoutPaidEmail({
              adminName:
                admin.contactName?.split(" ")[0] ||
                admin.email.split("@")[0] ||
                "där",
              orgName: org?.displayName ?? org?.name ?? "er förening",
              campaignName: campaign?.name ?? "kampanjen",
              amountOre: payout.teamShareOre,
              paidAt: now,
              paymentReference,
              payoutsUrl: `${SITE_URL}/forening/utbetalningar`,
            }),
          });
        } catch (err) {
          log.error(
            { err, payoutId: id },
            "payout.paid notification email failed"
          );
        }
      })();
    }

    return c.json({
      ok: true,
      status: updated.status,
      paidAt:
        targetStatus === "PAID" ? (updated as { paidAt?: Date }).paidAt : null,
      paymentReference,
    });
  } catch (err) {
    log.error({ err, payoutId: id }, "payout status patch failed");
    return c.json({ error: "Kunde inte uppdatera utbetalningen." }, 500);
  }
});
