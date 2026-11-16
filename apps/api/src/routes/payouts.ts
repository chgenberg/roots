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
 *   - PATCH  /v1/payouts/:id/status            — PAID only (INVOICED går via /settlement/create-invoice efter scout fix 2026-05-26)
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
import {
  computeTeamSettlement,
  payoutReviewState,
} from "../lib/settlement/compute";
import { db } from "@roots/db";
import {
  payouts,
  campaigns,
  organizations,
  users,
} from "@roots/db/schema";
import { isDemoSession } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { getEmailSender } from "../lib/email";
import {
  payoutPaidEmail,
  withLocalePath,
} from "../lib/email/templates";
import { resolveCanonicalSiteUrl } from "@roots/contracts";
import { resolveUiLocale, uiError, type UiLocale } from "../lib/ui-locale";
import {
  localizeDemoCampaignName,
  localizeDemoOrgName,
} from "../lib/demo-i18n";

const log = childLogger("payouts");

export const payoutsRoute = new Hono();

const SITE_URL = resolveCanonicalSiteUrl();

// Lokal helper-pattern matchar dashboard.ts/settlement.ts — vi exporterar
// inte en delad `requireSession` ännu (skulle vara en egen story att
// rycka ut till en lib).
// ────────────────────────────────────────────────────────────────────
// GET /v1/payouts (INTERNAL_ADMIN only — alla utbetalningar i systemet)
// ────────────────────────────────────────────────────────────────────
payoutsRoute.get("/", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  try {
    const rows = await db
      .select({
        id: payouts.id,
        campaignId: payouts.campaignId,
        campaignName: campaigns.name,
        campaignSlug: campaigns.slug,
        orgId: payouts.orgId,
        orgName: organizations.name,
        teamId: payouts.teamId,
        totalSalesOre: payouts.totalSalesOre,
        rootsShareOre: payouts.rootsShareOre,
        teamShareOre: payouts.teamShareOre,
        status: payouts.status,
        fortnoxInvoiceId: payouts.fortnoxInvoiceId,
        paidAt: payouts.paidAt,
        paymentReference: payouts.paymentReference,
        reviewRequiredAt: payouts.reviewRequiredAt,
        reviewResolvedAt: payouts.reviewResolvedAt,
        reviewResolvedTeamShareOre: payouts.reviewResolvedTeamShareOre,
        reviewNote: payouts.reviewNote,
        createdAt: payouts.createdAt,
        updatedAt: payouts.updatedAt,
      })
      .from(payouts)
      .leftJoin(campaigns, eq(payouts.campaignId, campaigns.id))
      .leftJoin(organizations, eq(payouts.orgId, organizations.id))
      .orderBy(desc(payouts.createdAt))
      .limit(200);

    // En flaggad utbetalning är fakturerad eller betald, och en order i
    // underlaget har sedan återbetalats eller avbokats. Beloppen på raden
    // rörs aldrig; här räknas bara fram vad som hade varit rätt, så att den
    // som reglerar saken med föreningen ser mellanskillnaden.
    const reviews = new Map<string, ReturnType<typeof payoutReviewState>>();
    for (const row of rows) {
      if (!row.reviewRequiredAt) continue;
      const current = await computeTeamSettlement(db, row.campaignId, row.teamId);
      reviews.set(row.id, payoutReviewState(row, current));
    }

    return c.json({
      payouts: rows.map(({ campaignSlug, campaignName, orgName, ...rest }) => ({
        ...rest,
        campaignName: localizeDemoCampaignName(
          locale,
          campaignName,
          campaignSlug
        ),
        orgName: localizeDemoOrgName(locale, orgName),
        review: reviews.get(rest.id) ?? null,
      })),
    });
  } catch (err) {
    log.error({ err }, "list payouts failed");
    return c.json({ error: uiError(locale, "couldNotFetchPayouts") }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /v1/payouts/mine (ASSOCIATION_ADMIN — för egna org:en)
// ────────────────────────────────────────────────────────────────────
payoutsRoute.get("/mine", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (
    session.role !== "ASSOCIATION_ADMIN" &&
    session.role !== "INTERNAL_ADMIN"
  ) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  if (!session.orgId) {
    return c.json({ error: uiError(locale, "noOrganisationOnSession") }, 422);
  }

  try {
    const rows = await db
      .select({
        id: payouts.id,
        campaignId: payouts.campaignId,
        campaignName: campaigns.name,
        campaignSlug: campaigns.slug,
        teamId: payouts.teamId,
        totalSalesOre: payouts.totalSalesOre,
        teamShareOre: payouts.teamShareOre,
        rootsShareOre: payouts.rootsShareOre,
        status: payouts.status,
        fortnoxInvoiceId: payouts.fortnoxInvoiceId,
        paidAt: payouts.paidAt,
        paymentReference: payouts.paymentReference,
        createdAt: payouts.createdAt,
        updatedAt: payouts.updatedAt,
      })
      .from(payouts)
      .leftJoin(campaigns, eq(payouts.campaignId, campaigns.id))
      .where(eq(payouts.orgId, session.orgId))
      .orderBy(desc(payouts.createdAt));

    return c.json({
      payouts: rows.map(({ campaignSlug, campaignName, ...rest }) => ({
        ...rest,
        campaignName: localizeDemoCampaignName(
          locale,
          campaignName,
          campaignSlug
        ),
      })),
    });
  } catch (err) {
    log.error({ err }, "list mine payouts failed");
    return c.json({ error: uiError(locale, "couldNotFetchPayouts") }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────
// PATCH /v1/payouts/:id/status
// ────────────────────────────────────────────────────────────────────

const ALLOWED_TARGET_STATUSES = ["INVOICED", "PAID"] as const;
type TargetStatus = (typeof ALLOWED_TARGET_STATUSES)[number];

payoutsRoute.patch("/:id/status", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  // Strikt admin-only. ASSOCIATION_ADMIN får inte själv flippa PAID
  // (skulle göra det enkelt att kvittera utan att Roots transferade).
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ error: uiError(locale, "invalidId") }, 400);
  }

  let body: {
    status?: TargetStatus;
    paymentReference?: string;
    expectedTeamShareOre?: number;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJsonShort") }, 400);
  }
  locale = resolveUiLocale(c, (body as { locale?: unknown }).locale);

  const targetStatus = body.status;
  if (!targetStatus || !ALLOWED_TARGET_STATUSES.includes(targetStatus)) {
    return c.json(
      {
        error: uiError(locale, "statusMustBeOneOfPrefix") + ALLOWED_TARGET_STATUSES.join(", "),
      },
      400
    );
  }

  const paymentReference = body.paymentReference?.trim() || null;
  if (paymentReference && paymentReference.length > 64) {
    return c.json({ error: uiError(locale, "referenceMax64") }, 400);
  }

  // Seeded admin@roots.se is flagged as demo, but is also the prod ops
  // login until staff accounts exist. Allow PAID with a bank reference;
  // block other demo mutations (e.g. fake INVOICED).
  if (isDemoSession(session)) {
    const allowOpsPaid = targetStatus === "PAID" && !!paymentReference;
    if (!allowOpsPaid) {
      return c.json(
        { error: uiError(locale, "demoCannotChangePayouts") },
        403
      );
    }
  }

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);

    if (!payout) {
      return c.json({ error: uiError(locale, "payoutNotFoundPeriod") }, 404);
    }

    // State-machine gates: kan bara gå PENDING→INVOICED och
    // {PENDING,INVOICED}→PAID. PAID är terminal — kräver manuell
    // DB-fix för att rolla tillbaka (medveten friction så ops
    // inte oavsiktligt "ångrar" en betalning utan postmortem).
    if (targetStatus === "INVOICED" && payout.status !== "PENDING") {
      return c.json(
        {
          error:
            uiError(locale, "payoutMarkInvoicedFromPendingPrefix") +
            payout.status +
            ").",
        },
        409
      );
    }
    // Scout fix 2026-05-26 (Money HIGH-006): INTERNAL_ADMIN kunde
    // tidigare manuellt sätta INVOICED utan att vi krävde att en
    // Fortnox-faktura faktiskt skapats. Det öppnade en bokförings-
    // gap: payout PAID utan korresponderande Fortnox-faktura. Tvinga
    // create-invoice-flödet (som sätter både status och
    // fortnoxInvoiceId atomiskt).
    if (targetStatus === "INVOICED") {
      return c.json(
        {
          error: uiError(locale, "useSettlementCreateInvoice"),
        },
        409
      );
    }
    const fortnoxOn =
      process.env.FORTNOX_ENABLED?.trim().toLowerCase() === "true";

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

    // En väntande utbetalning räknas om när en order återbetalas. Har
    // beloppet ändrats sedan sidan laddades har den som betalar kanske fört
    // över det gamla beloppet, och då ska det synas innan raden låses.
    if (
      targetStatus === "PAID" &&
      typeof body.expectedTeamShareOre === "number" &&
      body.expectedTeamShareOre !== payout.teamShareOre
    ) {
      return c.json(
        {
          error: uiError(locale, "payoutAmountChanged"),
          teamShareOre: payout.teamShareOre,
        },
        409
      );
    }

    // Med Fortnox aktiv: PENDING → create-invoice → INVOICED → PAID.
    // Utan Fortnox (nuvarande prod-läge): INTERNAL_ADMIN får markera
    // PENDING → PAID manuellt efter banköverföring, med betalningsreferens.
    if (fortnoxOn) {
      if (targetStatus === "PAID" && !payout.fortnoxInvoiceId) {
        return c.json(
          {
            error: uiError(locale, "payoutMissingFortnoxPaid"),
          },
          409
        );
      }
      if (targetStatus === "PAID" && payout.status !== "INVOICED") {
        return c.json(
          {
            error:
              uiError(locale, "payoutMustBeInvoicedBeforePaidPrefix") +
              payout.status +
              ").",
          },
          409
        );
      }
    } else if (targetStatus === "PAID") {
      if (payout.status !== "PENDING" && payout.status !== "INVOICED") {
        return c.json(
          {
            error:
              uiError(locale, "payoutMarkPaidFromPrefix") +
              payout.status +
              ").",
          },
          409
        );
      }
      if (!paymentReference) {
        return c.json(
          {
            error: uiError(locale, "enterPaymentReference"),
          },
          400
        );
      }
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
      .where(
        and(
          eq(payouts.id, id),
          // Raden ska vara den vi nyss läste: samma status och samma belopp.
          // En återbetalning som räknade om utbetalningen under tiden får
          // inte låsas in med ett belopp ingen har sett.
          eq(payouts.status, payout.status),
          eq(payouts.teamShareOre, payout.teamShareOre)
        )
      )
      .returning();

    if (!updated) {
      return c.json({ error: uiError(locale, "payoutAmountChanged") }, 409);
    }

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
            .select({ name: campaigns.name, slug: campaigns.slug })
            .from(campaigns)
            .where(eq(campaigns.id, payout.campaignId))
            .limit(1);

          // Club admins get Swedish mail by default (SE market), not
          // the INTERNAL_ADMIN actor's UI locale.
          const recipientLocale: UiLocale = "sv";

          await getEmailSender().sendEmail({
            to: admin.email,
            ...payoutPaidEmail({
              adminName:
                admin.contactName?.split(" ")[0] ||
                admin.email.split("@")[0] ||
                "där",
              orgName:
                org?.displayName ??
                org?.name ??
                "er förening",
              campaignName: campaign?.name ?? "kampanjen",
              amountOre: payout.teamShareOre,
              paidAt: now,
              paymentReference,
              payoutsUrl: `${SITE_URL}${withLocalePath("/forening/avrakning", recipientLocale)}`,
              locale: recipientLocale,
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
    return c.json({ error: uiError(locale, "couldNotUpdatePayout") }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /v1/payouts/:id/review/resolve  { note }
// ────────────────────────────────────────────────────────────────────
//
// Kvitterar flaggan på en utbetalning som behövde regleras för hand (en
// order återbetalades efter att föreningen fått sina pengar). Ändrar bara
// flaggan: belopp, status och betaluppgifter rörs aldrig härifrån.
payoutsRoute.post("/:id/review/resolve", async (c) => {
  const session = await requireSession(c);
  let locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotChangePayouts") }, 403);
  }

  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ error: uiError(locale, "invalidId") }, 400);
  }

  let body: { note?: unknown; expectedCorrectTeamShareOre?: unknown; locale?: unknown };
  try {
    const parsed: unknown = await c.req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    body = parsed;
  } catch {
    return c.json({ error: uiError(locale, "invalidJsonShort") }, 400);
  }
  locale = resolveUiLocale(c, body.locale);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 3 || note.length > 500) {
    return c.json({ error: uiError(locale, "payoutReviewNoteRequired") }, 400);
  }

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);
    if (!payout) {
      return c.json({ error: uiError(locale, "payoutNotFoundPeriod") }, 404);
    }
    const current = await computeTeamSettlement(db, payout.campaignId, payout.teamId);
    const review = payoutReviewState(payout, current);
    // Bara en flagga som faktiskt väntar kan kvitteras. Annars kunde en
    // andra tryckning skriva över anteckningen från den första.
    if (!review.needsReview) {
      return c.json({ error: uiError(locale, "payoutNoReviewNeeded") }, 409);
    }
    // Den som kvitterar ska ha sett rätt belopp. Har en ny återbetalning
    // kommit sedan sidan laddades gäller kvitteringen inte den.
    if (
      typeof body.expectedCorrectTeamShareOre === "number" &&
      body.expectedCorrectTeamShareOre !== review.correctTeamShareOre
    ) {
      return c.json(
        {
          error: uiError(locale, "payoutReviewChanged"),
          correctTeamShareOre: review.correctTeamShareOre,
        },
        409
      );
    }

    const now = new Date();
    const resolved = await db
      .update(payouts)
      .set({
        reviewResolvedAt: now,
        reviewResolvedByUserId: session.userId,
        reviewResolvedTeamShareOre: review.correctTeamShareOre,
        reviewNote: note,
      })
      .where(
        and(
          eq(payouts.id, id),
          // Flaggan ska vara den vi nyss läste. En återbetalning som hann
          // emellan sätter en ny tidpunkt, och då gäller kvitteringen inte.
          payout.reviewRequiredAt
            ? eq(payouts.reviewRequiredAt, payout.reviewRequiredAt)
            : isNull(payouts.reviewRequiredAt),
          // Och den ska fortfarande vänta: två samtidiga kvitteringar får
          // inte skriva över varandra.
          payout.reviewResolvedAt
            ? eq(payouts.reviewResolvedAt, payout.reviewResolvedAt)
            : isNull(payouts.reviewResolvedAt)
        )
      )
      .returning({ id: payouts.id });
    if (resolved.length === 0) {
      return c.json({ error: uiError(locale, "payoutReviewChanged") }, 409);
    }

    void auditLog({
      userId: session.userId,
      action: "payout.review.resolved",
      entityType: "payout",
      entityId: id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: payout.orgId,
        campaignId: payout.campaignId,
        payoutStatus: payout.status,
        paidTeamShareOre: payout.teamShareOre,
        correctTeamShareOre: review.correctTeamShareOre,
        overpaidOre: review.overpaidOre,
        resolvedNowOre: review.outstandingOre,
        note,
      },
    });

    return c.json({ ok: true, reviewResolvedAt: now, reviewNote: note });
  } catch (err) {
    log.error({ err, payoutId: id }, "payout review resolve failed");
    return c.json({ error: uiError(locale, "couldNotUpdatePayout") }, 500);
  }
});
