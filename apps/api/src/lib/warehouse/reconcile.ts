import { eq } from "drizzle-orm";
import { countsAsRevenue } from "@roots/contracts";
import { db } from "@roots/db";
import { customerOrders } from "@roots/db/schema";
import { childLogger } from "../logger";
import { getPaymentState } from "../payments/stripe";
import { judgePayment, type OrderForReconcile, type ReconcileVerdict } from "./judge";

export {
  isReconciled,
  judgePayment,
  needsAcknowledgement,
  type ReconcileStatus,
  type ReconcileVerdict,
} from "./judge";

const log = childLogger("warehouse");

/** Hämtar läget hos Stripe och fäller ett utslag. Fel hos Stripe blir en avvikelse, inte ett godkännande. */
export async function reconcileOrder(order: OrderForReconcile): Promise<ReconcileVerdict> {
  if (
    !countsAsRevenue(order.status) ||
    order.paymentMethod !== "STRIPE" ||
    !order.stripeCheckoutSessionId
  ) {
    return judgePayment(order, null);
  }
  try {
    const state = await getPaymentState(order.stripeCheckoutSessionId);
    return judgePayment(order, state);
  } catch (err) {
    log.warn({ err, orderId: order.id }, "Stripe reconciliation failed");
    return {
      status: "STRIPE_ERROR",
      note: err instanceof Error ? err.message.slice(0, 200) : "Okänt fel från Stripe",
    };
  }
}

/**
 * Stämmer av flera ordrar och sparar utslaget på var och en. Några i taget,
 * så att en lång lista inte slår i Stripes hastighetsgräns.
 */
export async function reconcileAndStore(
  orders: OrderForReconcile[]
): Promise<Map<string, ReconcileVerdict>> {
  const verdicts = new Map<string, ReconcileVerdict>();
  const queue = [...orders];
  const worker = async () => {
    for (let order = queue.shift(); order; order = queue.shift()) {
      const verdict = await reconcileOrder(order);
      verdicts.set(order.id, verdict);
      await db
        .update(customerOrders)
        .set({
          reconciledAt: new Date(),
          reconcileStatus: verdict.status,
          reconcileNote: verdict.note,
        })
        .where(eq(customerOrders.id, order.id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, orders.length) }, worker));
  return verdicts;
}
