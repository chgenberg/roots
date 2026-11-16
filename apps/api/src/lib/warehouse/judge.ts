import { countsAsRevenue } from "@roots/contracts";
import type { StripePaymentState } from "../payments/stripe";

/**
 * Avstämning av en order mot betalningen hos Stripe, innan den går till
 * lagret: betald, rätt belopp, rätt valuta och inte återbetald.
 */
export const RECONCILE_STATUSES = [
  "OK",
  /** Stämmer med Stripe, men en del är återbetald. En människa avgör vad som ska skickas. */
  "PARTLY_REFUNDED",
  "NOT_PAID",
  "AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  /** Stripe och vi är inte överens om hur mycket som återbetalats. */
  "REFUND_MISMATCH",
  /** Ordern har ingen kortbetalning hos Stripe att stämma av mot. */
  "NO_STRIPE_PAYMENT",
  /** Ordern är inte längre betald hos oss (avbokad, återbetald). */
  "NOT_OPEN",
  "STRIPE_ERROR",
] as const;
export type ReconcileStatus = (typeof RECONCILE_STATUSES)[number];

export interface ReconcileVerdict {
  status: ReconcileStatus;
  /** Siffrorna bakom en avvikelse, för den som ska reda ut den. */
  note: string | null;
}

/** Stämmer ordern, så att den får gå till lagret utan vidare? */
export function isReconciled(status: string | null | undefined): boolean {
  return status === "OK";
}

/** Avvikelser som en människa får godkänna efter att ha tittat på ordern. */
export function needsAcknowledgement(status: string | null | undefined): boolean {
  return status === "PARTLY_REFUNDED";
}

export interface OrderForReconcile {
  id: string;
  status: string;
  paymentMethod: string;
  stripeCheckoutSessionId: string | null;
  totalOre: number;
  refundedOre: number;
}

const kr = (ore: number) => `${(ore / 100).toFixed(2).replace(".", ",")} kr`;

/**
 * Jämför ordern med läget hos Stripe. `state = null` betyder att Stripe är
 * stubbat (bara utveckling och test), och då finns inget att jämföra med.
 */
export function judgePayment(
  order: OrderForReconcile,
  state: StripePaymentState | null
): ReconcileVerdict {
  if (!countsAsRevenue(order.status)) {
    return { status: "NOT_OPEN", note: `Orderstatus ${order.status}` };
  }
  if (order.paymentMethod !== "STRIPE" || !order.stripeCheckoutSessionId) {
    return {
      status: "NO_STRIPE_PAYMENT",
      note: `Betalsätt ${order.paymentMethod}, ingen betalning hos Stripe`,
    };
  }
  if (state !== null) {
    if (!state.paid) {
      return { status: "NOT_PAID", note: "Stripe visar ingen genomförd betalning" };
    }
    if (state.currency !== "SEK") {
      return { status: "CURRENCY_MISMATCH", note: `Betald i ${state.currency ?? "okänd valuta"}` };
    }
    if (state.amountTotalOre !== order.totalOre) {
      return {
        status: "AMOUNT_MISMATCH",
        note: `Stripe ${state.amountTotalOre === null ? "okänt belopp" : kr(state.amountTotalOre)}, ordern ${kr(order.totalOre)}`,
      };
    }
    if (state.amountRefundedOre !== order.refundedOre) {
      return {
        status: "REFUND_MISMATCH",
        note: `Återbetalt hos Stripe ${kr(state.amountRefundedOre)}, hos oss ${kr(order.refundedOre)}`,
      };
    }
  }
  if (order.refundedOre > 0) {
    return {
      status: "PARTLY_REFUNDED",
      note: `Delvis återbetald: ${kr(order.refundedOre)} av ${kr(order.totalOre)}`,
    };
  }
  return { status: "OK", note: state === null ? "Stripe stubbat (utvecklingsläge)" : null };
}
