import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  isStripeFailEvent,
  isStripePaidEvent,
  snapshotFromSession,
  snapshotFromWebhookEvent,
} from "./stripe";

function session(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    payment_status: "paid",
    status: "complete",
    amount_total: 19900,
    currency: "sek",
    locale: "sv",
    client_reference_id: "order-1",
    metadata: { orderId: "order-1", locale: "sv" },
    payment_method_types: ["card"],
    payment_intent: "pi_test_1",
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("stripe checkout helpers", () => {
  it("classifies paid and failed webhook events", () => {
    expect(isStripePaidEvent("checkout.session.completed")).toBe(true);
    expect(isStripePaidEvent("checkout.session.async_payment_succeeded")).toBe(
      true
    );
    expect(isStripeFailEvent("checkout.session.expired")).toBe(true);
    expect(isStripeFailEvent("checkout.session.async_payment_failed")).toBe(
      true
    );
    expect(isStripePaidEvent("customer.created")).toBe(false);
  });

  it("reads order id, amount and currency from a session", () => {
    const snap = snapshotFromSession(session());
    expect(snap.sessionId).toBe("cs_test_123");
    expect(snap.orderId).toBe("order-1");
    expect(snap.paid).toBe(true);
    expect(snap.expired).toBe(false);
    expect(snap.amountTotalOre).toBe(19900);
    expect(snap.currency).toBe("SEK");
    expect(snap.selectedPaymentMethod).toBe("card");
    expect(snap.locale).toBe("sv");
  });

  it("marks expired unpaid sessions", () => {
    const snap = snapshotFromSession(
      session({
        payment_status: "unpaid",
        status: "expired",
      })
    );
    expect(snap.paid).toBe(false);
    expect(snap.expired).toBe(true);
  });

  it("ignores unrelated webhook events", () => {
    expect(
      snapshotFromWebhookEvent({
        id: "evt_1",
        type: "customer.created",
        data: { object: session() },
      } as unknown as Stripe.Event)
    ).toBeNull();
  });
});
