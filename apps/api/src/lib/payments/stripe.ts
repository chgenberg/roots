import Stripe from "stripe";
import { childLogger } from "../logger";

const log = childLogger("stripe");

export const STRIPE_PAID_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export const STRIPE_FAIL_EVENTS = [
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
] as const;

export function isStripePaidEvent(type: string): boolean {
  return (STRIPE_PAID_EVENTS as readonly string[]).includes(type);
}

export function isStripeFailEvent(type: string): boolean {
  return (STRIPE_FAIL_EVENTS as readonly string[]).includes(type);
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Stripe is not configured");
  }
  return new Stripe(key);
}

function isStubAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ROOTS_STRIPE_STUB === "true";
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export interface StripeLineItem {
  name: string;
  quantity: number;
  unitAmountOre: number;
}

export interface CreateStripeSessionInput {
  orderId: string;
  customerEmail: string;
  locale: "sv" | "en";
  lineItems: StripeLineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface StripeCheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface StripeSessionSnapshot {
  sessionId: string;
  orderId: string | null;
  paid: boolean;
  expired: boolean;
  amountTotalOre: number | null;
  currency: string | null;
  selectedPaymentMethod: string | null;
  locale: "sv" | "en";
  paymentIntentId: string | null;
}

export async function createCheckoutSession(
  input: CreateStripeSessionInput
): Promise<StripeCheckoutSession> {
  if (!isStripeConfigured()) {
    if (!isStubAllowed()) {
      log.error(
        { nodeEnv: process.env.NODE_ENV },
        "Stripe credentials missing and stub mode not enabled — refusing to create checkout session"
      );
      throw new Error("Stripe is not configured");
    }
    return {
      sessionId: `cs_test_stub_${crypto.randomUUID().slice(0, 8)}`,
      checkoutUrl: input.successUrl,
    };
  }

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "sek",
    customer_email: input.customerEmail,
    locale: input.locale === "en" ? "en" : "sv",
    client_reference_id: input.orderId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
    billing_address_collection: "auto",
    line_items: input.lineItems.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: "sek",
        unit_amount: line.unitAmountOre,
        product_data: { name: line.name },
      },
    })),
    payment_intent_data: {
      metadata: {
        ...input.metadata,
        orderId: input.orderId,
        locale: input.locale,
      },
    },
    metadata: {
      ...input.metadata,
      orderId: input.orderId,
      locale: input.locale,
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session missing url");
  }

  return { sessionId: session.id, checkoutUrl: session.url };
}

export async function getCheckoutSession(
  sessionId: string
): Promise<StripeSessionSnapshot> {
  if (!isStripeConfigured()) {
    if (!isStubAllowed()) {
      log.error(
        { sessionId },
        "Stripe credentials missing and stub mode not enabled — refusing to read session"
      );
      throw new Error("Stripe is not configured");
    }
    return {
      sessionId,
      orderId: null,
      paid: true,
      expired: false,
      amountTotalOre: null,
      currency: "SEK",
      selectedPaymentMethod: "card",
      locale: "sv",
      paymentIntentId: null,
    };
  }

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.payment_method"],
  });
  return snapshotFromSession(session);
}

export async function getCheckoutUrl(
  sessionId: string
): Promise<string | null> {
  if (!isStripeConfigured()) return null;
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.url ?? null;
}

export function constructStripeEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
}

function selectedPaymentMethodFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const intent = session.payment_intent;
  if (intent && typeof intent === "object") {
    const method = intent.payment_method;
    if (method && typeof method === "object" && "type" in method) {
      return typeof method.type === "string" ? method.type : null;
    }
  }
  return session.payment_method_types?.[0] ?? "card";
}

export function snapshotFromWebhookEvent(
  event: Stripe.Event
): StripeSessionSnapshot | null {
  if (!isStripePaidEvent(event.type) && !isStripeFailEvent(event.type)) {
    return null;
  }
  return snapshotFromSession(event.data.object as Stripe.Checkout.Session);
}

export function snapshotFromSession(
  session: Stripe.Checkout.Session
): StripeSessionSnapshot {
  const localeRaw = session.locale || session.metadata?.locale || "sv";
  const locale: "sv" | "en" = localeRaw.toLowerCase().startsWith("en")
    ? "en"
    : "sv";
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const orderId =
    session.metadata?.orderId || session.client_reference_id || null;

  return {
    sessionId: session.id,
    orderId,
    paid: session.payment_status === "paid",
    expired: session.status === "expired",
    amountTotalOre:
      typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency ? session.currency.toUpperCase() : null,
    selectedPaymentMethod: selectedPaymentMethodFromSession(session),
    locale,
    paymentIntentId: paymentIntent,
  };
}

export function uiLocaleFromMetadata(
  locale: string | null | undefined
): "sv" | "en" {
  return locale?.toLowerCase().startsWith("en") ? "en" : "sv";
}
