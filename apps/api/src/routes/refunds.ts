/**
 * Återbetalning av en kundorder — bara INTERNAL_ADMIN.
 *
 *   POST /v1/admin/orders/:orderId/refund
 *   body: { requestId, reason, expectedRefundedOre, full: true }
 *       | { requestId, reason, expectedRefundedOre, goodsOre, shippingOre }
 *
 *   POST /v1/admin/orders/:orderId/refunds/sync
 *   Bokför det Stripe redan har: en återbetalning som gjorts direkt i
 *   Stripes panel, eller ett försök härifrån som aldrig blev klart.
 *
 * Ingen återbetalning sker automatiskt. En intern admin gör den från
 * portalen, pengarna går tillbaka via Stripe, och varje försök hamnar i
 * `customer_order_refunds` och i audit-loggen.
 *
 * Ordningen är vald efter vad som är värst att få fel:
 *
 *   1. Försöket sparas (PENDING) innan Stripe anropas. Avbryts något
 *      halvvägs finns ett spår kvar i stället för pengar utan förklaring.
 *   2. Stripe anropas med en idempotensnyckel byggd på klientens
 *      `requestId`. Samma försök blir aldrig två återbetalningar, hur många
 *      gånger anropet än görs om.
 *   3. Först när Stripe tagit emot återbetalningen ändras ordern, och i
 *      samma transaktion räknas lagets utbetalning om eller flaggas.
 *
 * När vi inte vet hur ett försök gick (avbrott mot Stripe, eller Stripe
 * klar men vår bokföring inte) gissar vi aldrig. Stripe är facit:
 *
 *   - Varje anrop börjar med att läsa vilka återbetalningar Stripe har på
 *     betalningen. Finns ett oavslutat försök där bokförs det; finns det
 *     inte och är gammalt nog har det aldrig nått fram och stängs.
 *   - Ingen ny återbetalning skapas så länge Stripes summa och vår inte är
 *     lika. Då måste det som saknas bokföras först (sync nedan).
 *   - Ett försök stängs som misslyckat bara när det är bevisat att Stripe
 *     inte har någon återbetalning för det: Stripe prövade just det
 *     försöket och sa nej, eller så föll det allra första anropet innan
 *     återbetalningen ens skickades. Ett fel på ett senare anrop bevisar
 *     ingenting om det första.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { countsAsRevenue } from "@roots/contracts";
import { db } from "@roots/db";
import { customerOrders, customerOrderRefunds } from "@roots/db/schema";
import { isDemoSession } from "../lib/session";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { acquireLock, releaseLock } from "../lib/redis-lock";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import {
  listRefundsForSession,
  refundCheckoutSession,
  StripeRefundError,
  type StripeRefundRecord,
} from "../lib/payments/stripe";
import {
  beginPayoutAdjustment,
  type PayoutAdjustment,
} from "../lib/settlement/compute";

const log = childLogger("refunds");

export const refundsAdmin = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Låset per order lever längre än det längsta ett anrop kan ta: Stripe-
 * anropen har korta tidsgränser (se stripe.ts) och summerar till under en
 * och en halv minut i värsta fall.
 */
const LOCK_TTL_SECONDS = 180;

/**
 * Ett försök yngre än så här kan fortfarande vara på väg hos Stripe, även
 * om Stripe inte visar det än. Först därefter räknas "finns inte hos
 * Stripe" som att försöket aldrig nådde fram.
 */
const IN_FLIGHT_WINDOW_MS = 3 * 60 * 1000;

/**
 * Så länge får ett avbrutet försök göras om med samma nyckel. Stripe minns
 * en idempotensnyckel i 24 timmar; efter det skulle ett omtag kunna bli en
 * andra återbetalning. Äldre försök avgörs i stället genom att fråga Stripe.
 */
const SAME_KEY_RETRY_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Skälet till en återbetalning är en intern anteckning. På ordern, som lag
 * och förening kan läsa, står bara att den är återbetald.
 */
const PUBLIC_REFUND_REASON = "Återbetald till kunden av Roots";
const EXTERNAL_REFUND_REASON = "Återbetald direkt i Stripe, bokförd i efterhand";
const ABANDONED_MESSAGE = "Avbrutet försök. Stripe har ingen återbetalning för det.";

type OrderRow = typeof customerOrders.$inferSelect;
type RefundRow = typeof customerOrderRefunds.$inferSelect;

interface Recorded {
  order: OrderRow;
  refund: RefundRow;
  payout: PayoutAdjustment;
  previousStatus: string;
  /** Raden var redan bokförd av ett annat anrop. Inget ändrades nu. */
  alreadyDone: boolean;
}

function refundResponse(order: OrderRow, refund: RefundRow, payout: PayoutAdjustment | null) {
  return {
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      totalOre: order.totalOre,
      refundedOre: order.refundedOre,
      refundedShippingOre: order.refundedShippingOre,
      refundedAt: order.refundedAt,
    },
    refund: {
      id: refund.id,
      amountOre: refund.amountOre,
      shippingOre: refund.shippingOre,
      stripeRefundId: refund.stripeRefundId,
    },
    payout,
  };
}

async function requireRefundAdmin(
  c: Context
): Promise<{ session: SessionData } | Response> {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (session.role !== "INTERNAL_ADMIN") {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: uiError(locale, "demoCannotRefund") }, 403);
  }
  return { session };
}

/** Vilken rad som ska bokföras: en befintlig, eller en ny för en återbetalning som bara finns hos Stripe. */
type RefundRowRef =
  | { id: string }
  | { external: { requestId: string; amountOre: number; reason: string } };

/**
 * Bokför en återbetalning som Stripe har: ordern får de nya beloppen,
 * försöket blir SUCCEEDED och lagets utbetalning räknas om eller flaggas,
 * allt i en transaktion.
 *
 * Anroparen har alltid Stripes eget id på återbetalningen. Det är beviset,
 * och därför bokförs även en rad som tidigare stängts som misslyckad: fanns
 * återbetalningen hos Stripe var stängningen fel.
 *
 * En återbetalning utifrån (gjord i Stripes panel) får sin rad skapad här,
 * i samma transaktion, så att den aldrig kan bli liggande halvfärdig. Den
 * räknas på varorna i första hand; bara det som överstiger varuvärdet som
 * är kvar räknas som frakt.
 */
async function recordRefund(input: {
  order: Pick<OrderRow, "id" | "campaignId" | "teamId">;
  row: RefundRowRef;
  stripeRefundId: string;
  userId: string;
}): Promise<Recorded> {
  return db.transaction(async (tx) => {
    // Kampanjens avräkning och utbetalningsraden låses först, sedan ordern,
    // i samma ordning som avräkningen och avbokningen.
    const payout = await beginPayoutAdjustment(tx, {
      campaignId: input.order.campaignId,
      teamId: input.order.teamId,
      orderId: input.order.id,
    });

    const [current] = await tx
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, input.order.id))
      .for("update")
      .limit(1);
    if (!current) throw new Error("order disappeared during refund");

    // Samma återbetalning hos Stripe bokförs aldrig två gånger.
    const [sameStripeRefund] = await tx
      .select()
      .from(customerOrderRefunds)
      .where(eq(customerOrderRefunds.stripeRefundId, input.stripeRefundId))
      .limit(1);
    if (sameStripeRefund?.status === "SUCCEEDED") {
      return {
        order: current,
        refund: sameStripeRefund,
        payout: { kind: "none" as const },
        previousStatus: current.status,
        alreadyDone: true,
      };
    }

    const now = new Date();
    let row: RefundRow | undefined;
    /** En återbetalning utifrån som ännu inte har någon rad hos oss. */
    let external: { requestId: string; amountOre: number; shippingOre: number; reason: string } | null =
      null;
    if ("id" in input.row) {
      [row] = await tx
        .select()
        .from(customerOrderRefunds)
        .where(eq(customerOrderRefunds.id, input.row.id))
        .for("update")
        .limit(1);
      if (!row) throw new Error("refund row disappeared during refund");
    } else {
      [row] = await tx
        .select()
        .from(customerOrderRefunds)
        .where(eq(customerOrderRefunds.requestId, input.row.external.requestId))
        .for("update")
        .limit(1);
      if (!row) {
        const remainingShippingOre = Math.max(
          0,
          current.shippingOre - current.refundedShippingOre
        );
        const remainingGoodsOre = Math.max(
          0,
          current.totalOre - current.refundedOre - remainingShippingOre
        );
        external = {
          ...input.row.external,
          shippingOre: Math.min(
            remainingShippingOre,
            Math.max(0, input.row.external.amountOre - remainingGoodsOre)
          ),
        };
      }
    }
    if (row && row.orderId !== current.id) {
      throw new Error("refund row belongs to another order");
    }
    if (row?.status === "SUCCEEDED") {
      // Ett annat anrop hann bokföra samma försök. Det är inget fel.
      return {
        order: current,
        refund: row,
        payout: { kind: "none" as const },
        previousStatus: current.status,
        alreadyDone: true,
      };
    }

    const amountOre = row ? row.amountOre : external!.amountOre;
    const shippingOre = row ? row.shippingOre : external!.shippingOre;

    // Stripe har redan betalat tillbaka. Beloppen får aldrig gå över vad
    // ordern innehöll, även om något annat skulle ha gått snett på vägen hit.
    const refundedOre = Math.min(current.totalOre, current.refundedOre + amountOre);
    const refundedShippingOre = Math.min(
      current.shippingOre,
      current.refundedShippingOre + shippingOre
    );
    if (current.refundedOre + amountOre > current.totalOre) {
      log.error(
        { orderId: current.id, stripeRefundId: input.stripeRefundId, totalOre: current.totalOre },
        "refund would exceed the order total — recorded amount capped, check the payment at Stripe"
      );
    }
    const fullyRefunded = refundedOre >= current.totalOre;

    const [updatedOrder] = await tx
      .update(customerOrders)
      .set({
        refundedOre,
        refundedShippingOre,
        refundedAt: now,
        updatedAt: now,
        // Delåterbetalning: ordern är fortfarande betald och behåller sin
        // status. Hel återbetalning stänger en betald order.
        ...(fullyRefunded && countsAsRevenue(current.status)
          ? {
              status: "REFUNDED" as const,
              cancelledAt: now,
              cancelledByUserId: input.userId,
              cancelReason: PUBLIC_REFUND_REASON,
            }
          : {}),
      })
      .where(eq(customerOrders.id, current.id))
      .returning();

    const [updatedRefund] = row
      ? await tx
          .update(customerOrderRefunds)
          .set({
            status: "SUCCEEDED",
            stripeRefundId: input.stripeRefundId,
            failureMessage: null,
            updatedAt: now,
          })
          .where(eq(customerOrderRefunds.id, row.id))
          .returning()
      : await tx
          .insert(customerOrderRefunds)
          .values({
            orderId: current.id,
            requestId: external!.requestId,
            amountOre: external!.amountOre,
            shippingOre: external!.shippingOre,
            reason: external!.reason,
            status: "SUCCEEDED",
            stripeRefundId: input.stripeRefundId,
            createdByUserId: input.userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

    return {
      order: updatedOrder,
      refund: updatedRefund,
      payout: await payout.finish(),
      previousStatus: current.status,
      alreadyDone: false,
    };
  });
}

/** Audit-poster för en bokförd återbetalning och vad den gjorde med utbetalningen. */
function auditRecorded(
  c: Context,
  userId: string,
  recorded: Recorded,
  extra: Record<string, unknown> = {}
): void {
  if (recorded.alreadyDone) return;
  const { order, refund, payout } = recorded;
  void auditLog({
    userId,
    action: order.status === "REFUNDED" ? "order.refunded" : "order.partially_refunded",
    entityType: "customer_order",
    entityId: order.id,
    meta: {
      ...requestContext((n) => c.req.header(n)),
      refundId: refund.id,
      stripeRefundId: refund.stripeRefundId,
      amountOre: refund.amountOre,
      shippingOre: refund.shippingOre,
      goodsOre: refund.amountOre - refund.shippingOre,
      reason: refund.reason,
      previousStatus: recorded.previousStatus,
      status: order.status,
      totalOre: order.totalOre,
      refundedOre: order.refundedOre,
      orgId: order.orgId,
      teamId: order.teamId,
      campaignId: order.campaignId,
      payout,
      ...extra,
    },
  });

  if (payout.kind === "recalculated") {
    void auditLog({
      userId,
      action: "payout.recalculated",
      entityType: "payout",
      entityId: payout.payoutId,
      meta: {
        cause: "order_refund",
        orderId: order.id,
        before: payout.before,
        after: payout.after,
      },
    });
  } else if (payout.kind === "flagged") {
    log.warn(
      { orderId: order.id, payout },
      "refund after payout was invoiced or paid — payout flagged for manual handling"
    );
    void auditLog({
      userId,
      action: "payout.review_required",
      entityType: "payout",
      entityId: payout.payoutId,
      meta: {
        cause: "order_refund",
        orderId: order.id,
        payoutStatus: payout.payoutStatus,
        paidTeamShareOre: payout.paidTeamShareOre,
        correctTeamShareOre: payout.correctTeamShareOre,
        overpaidOre: payout.overpaidOre,
        addedOre: payout.addedOre,
      },
    });
  }
}

type UnfinishedOutcome =
  /** Stripe hade återbetalningen. Den är nu bokförd. */
  | { kind: "recovered"; recorded: Recorded }
  /** Stripe saknar den och försöket är gammalt nog: det nådde aldrig fram. Stängt. */
  | { kind: "abandoned" }
  /** Stripe saknar den, men senaste anropet är så färskt att det kan vara på väg. */
  | { kind: "in_flight" };

/**
 * Avgör ett försök som blev liggande PENDING mot Stripes lista över
 * betalningens återbetalningar (`stripeRefunds`, null i stub-läge).
 */
async function resolveUnfinished(
  c: Context,
  userId: string,
  order: OrderRow,
  row: RefundRow,
  stripeRefunds: StripeRefundRecord[] | null
): Promise<UnfinishedOutcome> {
  const match = stripeRefunds?.find((r) => r.refundRowId === row.id);
  if (match) {
    const recorded = await recordRefund({
      order,
      row: { id: row.id },
      stripeRefundId: match.refundId,
      userId,
    });
    auditRecorded(c, userId, recorded, { recoveredFromStripe: true });
    return { kind: "recovered", recorded };
  }

  // Fönstret räknas från det senaste anropet till Stripe, inte från när
  // försöket skapades: ett omtag kan fortfarande vara på väg.
  const lastTouched = (row.lastAttemptAt ?? row.createdAt).getTime();
  if (Date.now() - lastTouched < IN_FLIGHT_WINDOW_MS) {
    return { kind: "in_flight" };
  }

  await db
    .update(customerOrderRefunds)
    .set({ status: "FAILED", failureMessage: ABANDONED_MESSAGE, updatedAt: new Date() })
    .where(
      and(eq(customerOrderRefunds.id, row.id), eq(customerOrderRefunds.status, "PENDING"))
    );
  void auditLog({
    userId,
    action: "order.refund.abandoned",
    entityType: "customer_order",
    entityId: order.id,
    meta: {
      ...requestContext((n) => c.req.header(n)),
      refundId: row.id,
      amountOre: row.amountOre,
    },
  });
  return { kind: "abandoned" };
}

/** Summan Stripe har betalat tillbaka på betalningen. */
function refundedAtStripe(stripeRefunds: StripeRefundRecord[]): number {
  return stripeRefunds.reduce((sum, r) => sum + r.amountOre, 0);
}

function isUniqueViolation(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  return code === "23505";
}

// ── POST /orders/:orderId/refund ─────────────────────────────────
refundsAdmin.post("/orders/:orderId/refund", async (c) => {
  const guarded = await requireRefundAdmin(c);
  if (guarded instanceof Response) return guarded;
  const { session } = guarded;
  let locale = resolveUiLocale(c);

  const orderId = c.req.param("orderId");
  if (!UUID_RE.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  let body: {
    requestId?: unknown;
    reason?: unknown;
    full?: unknown;
    goodsOre?: unknown;
    shippingOre?: unknown;
    expectedRefundedOre?: unknown;
    locale?: unknown;
  };
  try {
    const parsed: unknown = await c.req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    body = parsed;
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }
  locale = resolveUiLocale(c, body.locale);

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!REQUEST_ID_RE.test(requestId)) {
    return c.json({ error: uiError(locale, "refundRequestIdRequired") }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3) {
    return c.json({ error: uiError(locale, "enterReasonMin3") }, 400);
  }
  if (reason.length > 500) {
    return c.json({ error: uiError(locale, "reasonMax500") }, 400);
  }
  const full = body.full === true;
  const isAmount = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0;
  if (!full && (!isAmount(body.goodsOre) || !isAmount(body.shippingOre))) {
    return c.json({ error: uiError(locale, "refundAmountInvalid") }, 400);
  }
  if (!isAmount(body.expectedRefundedOre)) {
    return c.json({ error: uiError(locale, "refundAmountInvalid") }, 400);
  }

  // Ett försök i taget per order. Utan låset kan två samtidiga anrop båda
  // läsa samma "kvar att återbetala" och tillsammans betala tillbaka för
  // mycket. Går Redis inte att nå görs ingen återbetalning alls.
  const lockKey = `refund:order:${orderId}`;
  const lock = await acquireLock(lockKey, LOCK_TTL_SECONDS);
  if (lock.status === "unavailable") {
    log.error({ err: lock.error, orderId }, "refund lock unavailable (redis)");
    return c.json({ error: uiError(locale, "refundLockUnavailable") }, 503);
  }
  if (lock.status === "busy") {
    return c.json({ error: uiError(locale, "refundAlreadyRunning") }, 409);
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);

    // Samma försök igen (dubbelklick, eller omtag efter ett avbrott).
    const [sameRequest] = await db
      .select()
      .from(customerOrderRefunds)
      .where(eq(customerOrderRefunds.requestId, requestId))
      .limit(1);
    if (sameRequest && sameRequest.orderId !== orderId) {
      return c.json({ error: uiError(locale, "refundRequestIdRequired") }, 400);
    }
    if (sameRequest?.status === "SUCCEEDED") {
      return c.json({ ...refundResponse(order, sameRequest, null), alreadyDone: true });
    }
    if (sameRequest?.status === "FAILED") {
      return c.json(
        {
          error: sameRequest.failureMessage || uiError(locale, "refundFailed"),
          // Försöket är avslutat. Ett nytt behöver en ny nyckel.
          restart: true,
        },
        409
      );
    }

    if (order.paymentMethod !== "STRIPE" || !order.stripeCheckoutSessionId) {
      return c.json({ error: uiError(locale, "refundOnlyCardOrders") }, 400);
    }

    // Stripes egen lista över betalningens återbetalningar är facit för
    // allt som följer. Går den inte att läsa görs ingenting.
    let stripeRefunds: StripeRefundRecord[] | null;
    try {
      stripeRefunds = await listRefundsForSession(order.stripeCheckoutSessionId);
    } catch (err) {
      log.error({ err, orderId }, "could not list refunds at Stripe before refunding");
      return c.json({ error: uiError(locale, "refundStripeUnreachable") }, 502);
    }

    let refundRow: RefundRow;
    if (sameRequest) {
      // PENDING: vi vet inte hur förra anropet gick. Har Stripe
      // återbetalningen bokförs den. Annars är det säkert att anropa igen
      // med samma nyckel så länge Stripe minns den.
      const match = stripeRefunds?.find((r) => r.refundRowId === sameRequest.id);
      if (match) {
        const recovered = await recordRefund({
          order,
          row: { id: sameRequest.id },
          stripeRefundId: match.refundId,
          userId: session.userId,
        });
        auditRecorded(c, session.userId, recovered, { recoveredFromStripe: true });
        return c.json(refundResponse(recovered.order, recovered.refund, recovered.payout));
      }
      if (Date.now() - sameRequest.createdAt.getTime() > SAME_KEY_RETRY_WINDOW_MS) {
        // För gammalt för samma nyckel. Stripe har inget, så försöket
        // stängs och ett nytt får göras.
        await resolveUnfinished(c, session.userId, order, sameRequest, stripeRefunds);
        return c.json({ error: uiError(locale, "refundFailed"), restart: true }, 409);
      }
      // Stripe har inte det här försöket. Har Stripe ändå återbetalat något
      // som inte är bokfört (gjort i Stripes panel under tiden) skickas
      // inget mer förrän det är bokfört.
      if (stripeRefunds && refundedAtStripe(stripeRefunds) !== order.refundedOre) {
        return c.json(
          {
            error: uiError(locale, "refundBooksMismatch"),
            needsSync: true,
            atStripeOre: refundedAtStripe(stripeRefunds),
            refundedOre: order.refundedOre,
          },
          409
        );
      }
      refundRow = sameRequest;
    } else {
      // Ett tidigare försök som aldrig blev klart reds ut först. Innan dess
      // går "kvar att återbetala" inte att lita på.
      const [unfinished] = await db
        .select()
        .from(customerOrderRefunds)
        .where(
          and(
            eq(customerOrderRefunds.orderId, orderId),
            eq(customerOrderRefunds.status, "PENDING")
          )
        )
        .limit(1);
      if (unfinished) {
        const outcome = await resolveUnfinished(
          c,
          session.userId,
          order,
          unfinished,
          stripeRefunds
        );
        if (outcome.kind === "recovered") {
          // Ordern har ändrats under fötterna på den som tryckte. Stanna
          // och låt en människa se det nya läget innan mer betalas tillbaka.
          return c.json(
            {
              error: uiError(locale, "refundPreviousRecovered"),
              recovered: true,
              recoveredAmountOre: outcome.recorded.refund.amountOre,
              restart: true,
            },
            409
          );
        }
        if (outcome.kind === "in_flight") {
          return c.json({ error: uiError(locale, "refundAlreadyRunning") }, 409);
        }
      }

      if (order.status === "REFUNDED") {
        return c.json({ error: uiError(locale, "orderAlreadyRefunded") }, 409);
      }
      if (!countsAsRevenue(order.status)) {
        return c.json({ error: uiError(locale, "refundOnlyPaidOrders") }, 400);
      }

      const amounts = full
        ? null
        : { goodsOre: body.goodsOre as number, shippingOre: body.shippingOre as number };
      const expectedRefundedOre = body.expectedRefundedOre;

      // Kontrollerna och det nya försöket görs med orderraden låst, så att
      // inget hinner ändras mellan "kvar att återbetala" och raden som säger
      // hur mycket som ska tillbaka.
      const prepared = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(customerOrders)
          .where(eq(customerOrders.id, orderId))
          .for("update")
          .limit(1);
        if (!locked) return { kind: "gone" as const };

        // Stripe och vi ska vara överens om vad som redan är återbetalt.
        // Annars finns en återbetalning vi inte bokfört (gjord i Stripes
        // panel, eller ett försök som stängts fel), och då får ingen ny
        // skapas förrän den är bokförd.
        if (stripeRefunds && refundedAtStripe(stripeRefunds) !== locked.refundedOre) {
          return {
            kind: "books_mismatch" as const,
            atStripeOre: refundedAtStripe(stripeRefunds),
            refundedOre: locked.refundedOre,
          };
        }
        // Den som trycker ska ha sett ordern som den ser ut nu.
        if (expectedRefundedOre !== locked.refundedOre || !countsAsRevenue(locked.status)) {
          return { kind: "changed" as const, refundedOre: locked.refundedOre };
        }

        const remainingShippingOre = Math.max(0, locked.shippingOre - locked.refundedShippingOre);
        const remainingGoodsOre = Math.max(
          0,
          locked.totalOre - locked.refundedOre - remainingShippingOre
        );
        const goodsOre = amounts ? amounts.goodsOre : remainingGoodsOre;
        const shippingOre = amounts ? amounts.shippingOre : remainingShippingOre;
        const amountOre = goodsOre + shippingOre;
        if (
          amountOre <= 0 ||
          goodsOre > remainingGoodsOre ||
          shippingOre > remainingShippingOre
        ) {
          return { kind: "exceeds" as const, remainingGoodsOre, remainingShippingOre };
        }

        const now = new Date();
        const [row] = await tx
          .insert(customerOrderRefunds)
          .values({
            orderId,
            requestId,
            amountOre,
            shippingOre,
            reason,
            status: "PENDING",
            createdByUserId: session.userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return { kind: "ready" as const, row };
      }).catch((err: unknown) => {
        // Databasen tillåter ett oavslutat försök per order.
        if (isUniqueViolation(err)) return { kind: "busy" as const };
        throw err;
      });

      if (prepared.kind === "gone") {
        return c.json({ error: uiError(locale, "orderNotFound") }, 404);
      }
      if (prepared.kind === "busy") {
        return c.json({ error: uiError(locale, "refundAlreadyRunning") }, 409);
      }
      if (prepared.kind === "books_mismatch") {
        return c.json(
          {
            error: uiError(locale, "refundBooksMismatch"),
            needsSync: true,
            atStripeOre: prepared.atStripeOre,
            refundedOre: prepared.refundedOre,
            restart: true,
          },
          409
        );
      }
      if (prepared.kind === "changed") {
        return c.json(
          {
            error: uiError(locale, "refundOrderChanged"),
            refundedOre: prepared.refundedOre,
            restart: true,
          },
          409
        );
      }
      if (prepared.kind === "exceeds") {
        return c.json(
          {
            error: uiError(locale, "refundExceedsRemaining"),
            remainingGoodsOre: prepared.remainingGoodsOre,
            remainingShippingOre: prepared.remainingShippingOre,
          },
          400
        );
      }
      refundRow = prepared.row;
    }

    // Varje anrop till Stripe räknas på raden innan det görs. Blir något
    // liggande syns det när Stripe senast kan ha fått ett anrop, och om det
    // här var det första.
    const [attempt] = await db
      .update(customerOrderRefunds)
      .set({
        attempts: sql`${customerOrderRefunds.attempts} + 1`,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(customerOrderRefunds.id, refundRow.id), eq(customerOrderRefunds.status, "PENDING"))
      )
      .returning({ attempts: customerOrderRefunds.attempts });
    if (!attempt) {
      return c.json({ error: uiError(locale, "refundAlreadyRunning") }, 409);
    }

    let stripeRefund;
    try {
      stripeRefund = await refundCheckoutSession({
        sessionId: order.stripeCheckoutSessionId,
        amountOre: refundRow.amountOre,
        idempotencyKey: `roots-refund-${requestId}`,
        metadata: { orderId, refundId: refundRow.id },
      });
    } catch (err) {
      // Försöket stängs bara när det är bevisat att Stripe inte har någon
      // återbetalning för det: Stripe prövade just det här försöket och sa
      // nej, eller så var detta försökets allra första anrop och det föll
      // innan återbetalningen ens skickades. Ett fel på ett senare anrop
      // säger inget om det första, som kan ha lyckats utan att svaret nådde
      // oss.
      const settled =
        err instanceof StripeRefundError &&
        (err.settlesAttempt || (attempt.attempts === 1 && err.beforeCreate));
      if (!settled) {
        // Utfallet är okänt. Raden lämnas PENDING och ingenting ändras på
        // ordern. Samma nyckel igen slutför; annars avgörs försöket mot
        // Stripes lista vid nästa anrop.
        log.error(
          { err, orderId, refundId: refundRow.id, attempts: attempt.attempts },
          "Stripe refund call failed with unknown outcome"
        );
        return c.json({ error: uiError(locale, "refundStripeUnreachable") }, 502);
      }
      const stripeError = (err as StripeRefundError).message;
      await db
        .update(customerOrderRefunds)
        .set({ status: "FAILED", failureMessage: stripeError, updatedAt: new Date() })
        .where(
          and(
            eq(customerOrderRefunds.id, refundRow.id),
            eq(customerOrderRefunds.status, "PENDING")
          )
        );
      void auditLog({
        userId: session.userId,
        action: "order.refund.failed",
        entityType: "customer_order",
        entityId: orderId,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          refundId: refundRow.id,
          amountOre: refundRow.amountOre,
          shippingOre: refundRow.shippingOre,
          reason: refundRow.reason,
          stripeError,
        },
      });
      log.warn({ orderId, refundId: refundRow.id, stripeError }, "Stripe declined refund");
      return c.json(
        {
          error: uiError(locale, "refundStripeDeclined"),
          stripeError,
          restart: true,
        },
        502
      );
    }

    let recorded: Recorded;
    try {
      recorded = await recordRefund({
        order,
        row: { id: refundRow.id },
        stripeRefundId: stripeRefund.refundId,
        userId: session.userId,
      });
    } catch (err) {
      log.error(
        { err, orderId, refundId: refundRow.id, stripeRefundId: stripeRefund.refundId },
        "CRITICAL: Stripe refund succeeded but the order could not be updated — the next attempt or a sync records it"
      );
      void auditLog({
        userId: session.userId,
        action: "order.refund.unrecorded",
        entityType: "customer_order",
        entityId: orderId,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          refundId: refundRow.id,
          stripeRefundId: stripeRefund.refundId,
          amountOre: refundRow.amountOre,
        },
      });
      return c.json(
        {
          error: uiError(locale, "refundDoneNotSaved"),
          stripeRefundId: stripeRefund.refundId,
          retryable: true,
        },
        500
      );
    }

    auditRecorded(c, session.userId, recorded, { stripeStatus: stripeRefund.status });
    return c.json(refundResponse(recorded.order, recorded.refund, recorded.payout));
  } catch (err) {
    log.error({ err, orderId }, "refund failed");
    return c.json({ error: uiError(locale, "refundFailed") }, 500);
  } finally {
    await releaseLock(lockKey, lock.token);
  }
});

// ── POST /orders/:orderId/refunds/sync ───────────────────────────
//
// Stripe är facit för vad som faktiskt betalats tillbaka. Den här vägen
// läser betalningens återbetalningar och bokför det som saknas hos oss:
//
//   - ett försök härifrån som blev liggande (Stripe klar, vi inte), och
//   - en återbetalning som gjorts direkt i Stripes panel.
//
// Den skapar aldrig en återbetalning. En återbetalning utifrån bokförs på
// varorna, utom när den gör ordern helt återbetald; då ingår frakten.
refundsAdmin.post("/orders/:orderId/refunds/sync", async (c) => {
  const guarded = await requireRefundAdmin(c);
  if (guarded instanceof Response) return guarded;
  const { session } = guarded;
  const locale = resolveUiLocale(c);

  const orderId = c.req.param("orderId");
  if (!UUID_RE.test(orderId)) {
    return c.json({ error: uiError(locale, "invalidOrderId") }, 400);
  }

  const lockKey = `refund:order:${orderId}`;
  const lock = await acquireLock(lockKey, LOCK_TTL_SECONDS);
  if (lock.status === "unavailable") {
    log.error({ err: lock.error, orderId }, "refund lock unavailable (redis)");
    return c.json({ error: uiError(locale, "refundLockUnavailable") }, 503);
  }
  if (lock.status === "busy") {
    return c.json({ error: uiError(locale, "refundAlreadyRunning") }, 409);
  }

  try {
    let [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);
    if (!order) return c.json({ error: uiError(locale, "orderNotFound") }, 404);
    if (order.paymentMethod !== "STRIPE" || !order.stripeCheckoutSessionId) {
      return c.json({ error: uiError(locale, "refundOnlyCardOrders") }, 400);
    }
    // En order som aldrig blev betald hos oss har inget att bokföra mot.
    if (!countsAsRevenue(order.status) && order.status !== "REFUNDED") {
      return c.json({ error: uiError(locale, "refundOnlyPaidOrders") }, 400);
    }

    let stripeRefunds: StripeRefundRecord[] | null;
    try {
      stripeRefunds = await listRefundsForSession(order.stripeCheckoutSessionId);
    } catch (err) {
      log.error({ err, orderId }, "could not list refunds at Stripe");
      return c.json({ error: uiError(locale, "refundStripeUnreachable") }, 502);
    }

    const rows = await db
      .select()
      .from(customerOrderRefunds)
      .where(eq(customerOrderRefunds.orderId, orderId));

    const summary = {
      recovered: 0,
      abandoned: 0,
      recorded: 0,
      /** Summan som bokfördes nu, både återfunna egna försök och det som gjorts i Stripe. */
      recordedOre: 0,
      /** Bokförda hos oss men borta hos Stripe (misslyckade i efterhand). Kräver en människa. */
      missingAtStripe: [] as Array<{ refundId: string; amountOre: number }>,
      payout: null as PayoutAdjustment | null,
    };

    /** Det tyngsta utfallet vinner: en flagga får inte döljas av en senare "ingen ändring". */
    const notePayout = (effect: PayoutAdjustment) => {
      const weight = { none: 0, recalculated: 1, flagged: 2 } as const;
      if (!summary.payout || weight[effect.kind] >= weight[summary.payout.kind]) {
        summary.payout = effect;
      }
    };

    // 1. Egna försök som blev liggande.
    for (const row of rows.filter((r) => r.status === "PENDING")) {
      const outcome = await resolveUnfinished(c, session.userId, order, row, stripeRefunds);
      if (outcome.kind === "recovered") {
        summary.recovered += 1;
        summary.recordedOre += outcome.recorded.refund.amountOre;
        notePayout(outcome.recorded.payout);
        order = outcome.recorded.order;
      } else if (outcome.kind === "abandoned") {
        summary.abandoned += 1;
      }
    }

    // 2. Det vi bokfört som Stripe inte längre har (en återbetalning som
    // misslyckats i efterhand). Stub-läget har inget facit.
    if (stripeRefunds) {
      const atStripe = new Set(stripeRefunds.map((r) => r.refundId));
      for (const row of rows) {
        if (row.status === "SUCCEEDED" && row.stripeRefundId && !atStripe.has(row.stripeRefundId)) {
          summary.missingAtStripe.push({ refundId: row.id, amountOre: row.amountOre });
        }
      }
      if (summary.missingAtStripe.length > 0) {
        log.error(
          { orderId, missing: summary.missingAtStripe },
          "refunds recorded here are missing or failed at Stripe — manual handling required"
        );
      }
    }

    // 3. Det Stripe har som vi inte har bokfört. Hoppas över när något vi
    // bokfört saknas hos Stripe: då är våra siffror redan för höga, och en
    // ersättning gjord i Stripes panel hade räknats dubbelt. Det läget
    // kräver en människa.
    const known = new Set(rows.map((r) => r.stripeRefundId).filter(Boolean));
    const rowById = new Map(rows.map((r) => [r.id, r]));
    for (const record of summary.missingAtStripe.length > 0 ? [] : (stripeRefunds ?? [])) {
      if (known.has(record.refundId)) continue;
      const own = record.refundRowId ? rowById.get(record.refundRowId) : undefined;
      // Bokfördes nyss i steg 1, eller är ett försök som fortfarande är på väg.
      if (own && own.status === "PENDING") continue;

      const recorded = await recordRefund({
        order,
        row: own
          ? // Ett eget försök som stängts som misslyckat, fast Stripe hade
            // det. Stripes lista är beviset, så det bokförs nu.
            { id: own.id }
          : // Gjord direkt i Stripes panel.
            {
              external: {
                requestId: `stripe-${record.refundId}`.slice(0, 64),
                amountOre: record.amountOre,
                reason: EXTERNAL_REFUND_REASON,
              },
            },
        stripeRefundId: record.refundId,
        userId: session.userId,
      });
      if (recorded.alreadyDone) continue;
      auditRecorded(c, session.userId, recorded, {
        ...(own ? { recoveredFromStripe: true } : { recordedFromStripe: true }),
      });
      if (own) summary.recovered += 1;
      else summary.recorded += 1;
      summary.recordedOre += recorded.refund.amountOre;
      notePayout(recorded.payout);
      order = recorded.order;
    }

    void auditLog({
      userId: session.userId,
      action: "order.refunds.synced",
      entityType: "customer_order",
      entityId: orderId,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        recovered: summary.recovered,
        abandoned: summary.abandoned,
        recorded: summary.recorded,
        recordedOre: summary.recordedOre,
        missingAtStripe: summary.missingAtStripe,
      },
    });

    return c.json({
      ok: true,
      ...summary,
      order: {
        id: order.id,
        status: order.status,
        totalOre: order.totalOre,
        refundedOre: order.refundedOre,
        refundedShippingOre: order.refundedShippingOre,
      },
    });
  } catch (err) {
    log.error({ err, orderId }, "refund sync failed");
    return c.json({ error: uiError(locale, "refundSyncFailed") }, 500);
  } finally {
    await releaseLock(lockKey, lock.token);
  }
});
