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
  /** Sajten som skapade sessionen (metadata.site). Null för äldre sessioner och andras. */
  site: string | null;
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
    // Kontot har Adaptive Pricing på som standard, och då erbjuder Stripe
    // utländska kort att betala i egen valuta. Kunder betalar alltid i SEK.
    adaptive_pricing: { enabled: false },
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
      site: null,
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
    site: session.metadata?.site || null,
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

export interface StripeRefundResult {
  refundId: string;
  /** Stripes status: succeeded eller pending räknas som genomförd. */
  status: string;
  amountOre: number;
}

/**
 * Det här anropet skapade ingen återbetalning. Meddelandet är Stripes eget.
 *
 * `settlesAttempt` säger hur långt det beviset räcker:
 *
 *   - true: Stripe prövade just den här återbetalningen (samma
 *     idempotensnyckel) och sa nej. Hade ett tidigare anrop med nyckeln gått
 *     fram hade Stripe svarat med det i stället. Försöket är alltså avgjort,
 *     hur många anrop som än gjorts.
 *   - false: Stripe prövade aldrig återbetalningen (betalningen gick inte
 *     att läsa, nyckeln avvisades, för många anrop). Det säger ingenting om
 *     ett tidigare anrop.
 *
 * `beforeCreate` säger om felet kom innan `refunds.create` alls anropades.
 * Bara då, och bara på försökets allra första anrop, är det säkert att
 * ingen återbetalning finns: Stripes klient kan göra ett eget dolt omförsök
 * på ett anrop som redan gått fram, och svaret på omförsöket (t.ex. "för
 * många anrop") bevisar då ingenting.
 *
 * Alla andra fel från `refundCheckoutSession` (nätverksavbrott, tidsgräns,
 * 5xx) betyder att utfallet är okänt. Då avgörs försöket genom att fråga
 * Stripe med `listRefundsForSession`.
 */
export class StripeRefundError extends Error {
  constructor(
    message: string,
    readonly settlesAttempt: boolean,
    readonly beforeCreate: boolean
  ) {
    super(message);
    this.name = "StripeRefundError";
  }
}

/**
 * Tidsgränser för anropen kring en återbetalning. De hålls korta och utan
 * omförsök på själva återbetalningen, så att ett anrop aldrig lever längre
 * än låset som håller andra försök på samma order borta.
 */
const REFUND_READ_OPTIONS = { timeout: 15_000, maxNetworkRetries: 1 } as const;
const REFUND_CREATE_TIMEOUT_MS = 20_000;

/** Stripe prövade återbetalningen och sa nej (redan återbetalt, för högt belopp, spärrat kort). */
function isRefundRejection(err: unknown): err is Error {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError ||
    err instanceof Stripe.errors.StripeCardError
  );
}

/** Anropet avvisades innan Stripe prövade det (nyckel, behörighet, för många anrop). */
function isRejectedBeforeProcessing(err: unknown): err is Error {
  return (
    err instanceof Stripe.errors.StripeAuthenticationError ||
    err instanceof Stripe.errors.StripePermissionError ||
    err instanceof Stripe.errors.StripeRateLimitError
  );
}

async function paymentIntentForSession(
  stripe: Stripe,
  sessionId: string
): Promise<{ paymentIntent: string | null; paid: boolean }> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {}, REFUND_READ_OPTIONS);
  return {
    paymentIntent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    paid: session.payment_status === "paid",
  };
}

/**
 * Återbetalar hela eller en del av en betald Checkout-session till kundens
 * kort.
 *
 * `idempotencyKey` gör att samma försök aldrig blir två återbetalningar hos
 * Stripe, även om vårt anrop görs om efter ett avbrott.
 */
export async function refundCheckoutSession(input: {
  sessionId: string;
  amountOre: number;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<StripeRefundResult> {
  if (!Number.isInteger(input.amountOre) || input.amountOre <= 0) {
    throw new StripeRefundError("Refund amount must be a positive integer", false, true);
  }

  if (!isStripeConfigured()) {
    if (!isStubAllowed()) {
      log.error(
        { sessionId: input.sessionId },
        "Stripe credentials missing and stub mode not enabled — refusing to refund"
      );
      throw new StripeRefundError("Stripe is not configured", false, true);
    }
    return {
      refundId: `re_test_stub_${input.idempotencyKey.slice(-12)}`,
      status: "succeeded",
      amountOre: input.amountOre,
    };
  }

  const stripe = stripeClient();

  // Att läsa betalningen skapar ingenting, så det här anropet har inte
  // rört några pengar. Men ett läsfel säger inget om tidigare anrop.
  let paymentIntent: string | null;
  try {
    const payment = await paymentIntentForSession(stripe, input.sessionId);
    if (!payment.paymentIntent || !payment.paid) {
      // Stripe svarade: betalningen finns inte. Då finns inget att återbetala alls.
      throw new StripeRefundError(
        "The checkout session has no completed payment to refund",
        true,
        true
      );
    }
    paymentIntent = payment.paymentIntent;
  } catch (err) {
    if (err instanceof StripeRefundError) throw err;
    throw new StripeRefundError(
      `Could not read the payment at Stripe: ${err instanceof Error ? err.message : "unknown error"}`,
      false,
      true
    );
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        amount: input.amountOre,
        reason: "requested_by_customer",
        metadata: input.metadata,
      },
      {
        idempotencyKey: input.idempotencyKey,
        timeout: REFUND_CREATE_TIMEOUT_MS,
        maxNetworkRetries: 0,
      }
    );
  } catch (err) {
    // Stripes egna avslag ska nå den som tryckte på knappen. Nätverksfel,
    // tidsgräns, 5xx och en upptagen idempotensnyckel bubblar: då är
    // utfallet okänt.
    if (isRefundRejection(err)) throw new StripeRefundError(err.message, true, false);
    if (isRejectedBeforeProcessing(err)) throw new StripeRefundError(err.message, false, false);
    throw err;
  }

  if (refund.status === "failed" || refund.status === "canceled") {
    throw new StripeRefundError(
      `Stripe refund ${refund.id} ended with status ${refund.status}`,
      true,
      false
    );
  }
  return {
    refundId: refund.id,
    status: refund.status ?? "pending",
    amountOre: refund.amount,
  };
}

export interface StripeRefundRecord {
  refundId: string;
  amountOre: number;
  /** Stripes status. Misslyckade och annullerade tas inte med. */
  status: string;
  /** Vårt id på försöket (`metadata.refundId`), om återbetalningen gjordes härifrån. */
  refundRowId: string | null;
  createdAt: Date;
}

/**
 * Alla återbetalningar Stripe har på en betalning, äldst först. Det här är
 * facit när vi själva är osäkra: ett avbrutet försök som finns här har gått
 * igenom, ett som saknas har aldrig nått fram.
 *
 * Returnerar null i stub-läge, där det inte finns något facit att fråga.
 */
export async function listRefundsForSession(
  sessionId: string
): Promise<StripeRefundRecord[] | null> {
  if (!isStripeConfigured()) {
    if (!isStubAllowed()) throw new Error("Stripe is not configured");
    return null;
  }
  const stripe = stripeClient();
  const { paymentIntent } = await paymentIntentForSession(stripe, sessionId);
  if (!paymentIntent) return [];

  const records: StripeRefundRecord[] = [];
  for await (const refund of stripe.refunds.list(
    { payment_intent: paymentIntent, limit: 100 },
    REFUND_READ_OPTIONS
  )) {
    if (refund.status === "failed" || refund.status === "canceled") continue;
    records.push({
      refundId: refund.id,
      amountOre: refund.amount,
      status: refund.status ?? "pending",
      refundRowId: refund.metadata?.refundId || null,
      createdAt: new Date(refund.created * 1000),
    });
  }
  return records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export interface StripePaymentState {
  sessionId: string;
  paid: boolean;
  amountTotalOre: number | null;
  currency: string | null;
  /** Summan Stripe har återbetalat på betalningen. */
  amountRefundedOre: number;
  paymentIntentId: string | null;
}

/**
 * Läget hos Stripe för en betalning: betald, belopp, valuta och hur mycket
 * som återbetalats. Används för avstämningen innan en order går till lagret.
 * Returnerar null i stub-läge, där det inte finns något att stämma av mot.
 */
export async function getPaymentState(
  sessionId: string
): Promise<StripePaymentState | null> {
  if (!isStripeConfigured()) {
    if (!isStubAllowed()) throw new Error("Stripe is not configured");
    return null;
  }
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"],
  });
  const intent =
    session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent
      : null;
  const charge =
    intent?.latest_charge && typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : null;
  return {
    sessionId: session.id,
    paid: session.payment_status === "paid",
    amountTotalOre:
      typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency ? session.currency.toUpperCase() : null,
    amountRefundedOre: charge?.amount_refunded ?? 0,
    paymentIntentId:
      intent?.id ??
      (typeof session.payment_intent === "string" ? session.payment_intent : null),
  };
}
