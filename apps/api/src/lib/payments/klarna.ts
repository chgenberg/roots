import { childLogger } from "../logger";

const log = childLogger("klarna");

const KLARNA_API_URL =
  process.env.KLARNA_ENV === "production"
    ? "https://api.klarna.com"
    : "https://api.playground.klarna.com";

const KLARNA_USERNAME = process.env.KLARNA_USERNAME || "";
const KLARNA_PASSWORD = process.env.KLARNA_PASSWORD || "";

/**
 * P1.4 (audit 2026-05-26): "stub-mode" får aldrig auto-completa
 * orders i en produktions-miljö. Innan denna guard räckte ett
 * deploy utan KLARNA_USERNAME/PASSWORD för att supportern skulle
 * nå PAID-status och därmed dras in i settlement utan att pengar
 * faktiskt flyttats.
 *
 * Regler:
 *   1. Stub är ENBART tillåten utanför NODE_ENV=production.
 *   2. Stub kräver explicit opt-in via ROOTS_KLARNA_STUB=true så
 *      dev/staging inte heller råkar stub:a om någon lägger till
 *      env-vars stegvis.
 *   3. Om creds saknas i prod kastar vi i createCheckoutSession/
 *      getCheckoutOrder så att checkout fail:ar tydligt 502 istället
 *      för att glida igenom till PAID utan betalning.
 */
function isStubAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ROOTS_KLARNA_STUB === "true";
}

function getAuthHeader(): string {
  return (
    "Basic " + Buffer.from(`${KLARNA_USERNAME}:${KLARNA_PASSWORD}`).toString("base64")
  );
}

// Connection-audit P1 #15: every outbound Klarna call gets a 15 s ceiling
// so a stalled connection doesn't hold the request handler open forever.
async function klarnaFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function isKlarnaConfigured(): boolean {
  return Boolean(KLARNA_USERNAME && KLARNA_PASSWORD);
}

interface KlarnaOrderLine {
  type: "physical" | "shipping_fee" | "discount";
  reference: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
  total_tax_amount: number;
}

interface CreateKlarnaSessionInput {
  purchaseCountry: string;
  purchaseCurrency: string;
  locale: string;
  orderLines: KlarnaOrderLine[];
  orderAmount: number;
  orderTaxAmount: number;
  merchantUrls: {
    terms: string;
    checkout: string;
    confirmation: string;
    push: string;
  };
  merchantReference1?: string;
  merchantReference2?: string;
}

interface KlarnaCheckoutSession {
  orderId: string;
  htmlSnippet: string;
  status: string;
}

export async function createCheckoutSession(
  input: CreateKlarnaSessionInput
): Promise<KlarnaCheckoutSession> {
  if (!isKlarnaConfigured()) {
    if (!isStubAllowed()) {
      // P1.4: hellre tydlig 502 i prod än silent auto-PAID. Logga
      // explicit så ops ser i konsolen att Klarna-creds saknas.
      log.error(
        { nodeEnv: process.env.NODE_ENV },
        "Klarna credentials missing and stub mode not enabled — refusing to create checkout session"
      );
      throw new Error("Klarna is not configured");
    }
    return {
      orderId: `mock-${crypto.randomUUID().slice(0, 8)}`,
      htmlSnippet: `<div id="klarna-checkout-container" style="padding:40px;text-align:center;border:2px dashed #ccc;border-radius:12px;">
        <p style="font-size:18px;font-weight:600;">Klarna Checkout (testläge)</p>
        <p style="color:#666;">Klarna-integration kräver merchant-credentials.</p>
        <p style="color:#666;">Belopp: ${(input.orderAmount / 100).toLocaleString("sv-SE")} kr</p>
        <button onclick="window.location.href='${input.merchantUrls.confirmation}'" style="margin-top:16px;padding:12px 24px;background:#1C1410;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Simulera betalning</button>
      </div>`,
      status: "checkout_incomplete",
    };
  }

  const res = await klarnaFetch(`${KLARNA_API_URL}/checkout/v3/orders`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      purchase_country: input.purchaseCountry,
      purchase_currency: input.purchaseCurrency,
      locale: input.locale,
      order_amount: input.orderAmount,
      order_tax_amount: input.orderTaxAmount,
      order_lines: input.orderLines,
      merchant_urls: input.merchantUrls,
      merchant_reference1: input.merchantReference1,
      merchant_reference2: input.merchantReference2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klarna API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    orderId: data.order_id,
    htmlSnippet: data.html_snippet,
    status: data.status,
  };
}

export interface KlarnaOrderSnapshot {
  orderId: string;
  status: string;
  /** Klarna's authoritative captured/authorised amount in öre. */
  orderAmount: number | null;
  /** ISO-4217 currency code Klarna processed in (e.g. "SEK"). */
  purchaseCurrency: string | null;
  /**
   * Det betalinstrument kunden faktiskt valde inne i Klarna, t.ex.
   * "swish", "card", "pay_later", "pay_now". Klarna returnerar detta i
   * `initial_payment_method.type` när ordern är slutförd. Swish via
   * Klarna landar här som "swish" så att vi kan särskilja Swish-betalda
   * ordrar i dashboards/avräkning utan en separat Swish-integration.
   */
  selectedPaymentMethod: string | null;
  /** Encoded as `{sellerId}|{uiLocale}` at session create. */
  merchantReference2: string | null;
  billingAddress?: {
    given_name?: string;
    family_name?: string;
    email?: string;
  };
}

/**
 * Normalisera Klarnas `initial_payment_method` till en kort, stabil
 * sträng vi sparar i `customer_orders.selected_payment_method`.
 * Klarna kan rapportera type i olika casing/format mellan miljöer.
 */
function extractSelectedPaymentMethod(
  data: Record<string, unknown>
): string | null {
  const ipm = data.initial_payment_method as
    | { type?: unknown; description?: unknown }
    | undefined;
  if (ipm && typeof ipm.type === "string" && ipm.type.trim().length > 0) {
    return ipm.type.trim().toLowerCase().slice(0, 40);
  }
  return null;
}

export async function getCheckoutOrder(
  orderId: string
): Promise<KlarnaOrderSnapshot> {
  if (!isKlarnaConfigured()) {
    if (!isStubAllowed()) {
      // P1.4: webhook + confirm-polling använder båda detta. Om
      // creds saknas i prod ska vi INTE returnera checkout_complete
      // — det skulle flippa orders till PAID utan att Klarna har
      // sett en krona. Kasta så caller fail:ar 500/500 öppet.
      log.error(
        { orderId },
        "Klarna credentials missing and stub mode not enabled — refusing to read order"
      );
      throw new Error("Klarna is not configured");
    }
    return {
      orderId,
      status: "checkout_complete",
      orderAmount: null,
      purchaseCurrency: "SEK",
      selectedPaymentMethod: "swish",
      merchantReference2: null,
      billingAddress: {
        given_name: "Test",
        family_name: "Testsson",
        email: "test@test.se",
      },
    };
  }

  const res = await klarnaFetch(
    `${KLARNA_API_URL}/checkout/v3/orders/${orderId}`,
    {
      headers: { Authorization: getAuthHeader() },
    }
  );

  if (!res.ok) {
    throw new Error(`Klarna order fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return {
    orderId: String(data.order_id ?? orderId),
    status: String(data.status ?? ""),
    orderAmount:
      typeof data.order_amount === "number" ? data.order_amount : null,
    purchaseCurrency:
      typeof data.purchase_currency === "string"
        ? (data.purchase_currency as string).toUpperCase()
        : null,
    selectedPaymentMethod: extractSelectedPaymentMethod(data),
    merchantReference2:
      typeof data.merchant_reference2 === "string"
        ? data.merchant_reference2
        : null,
    billingAddress: (data.billing_address as KlarnaOrderSnapshot["billingAddress"]) ?? undefined,
  };
}

/** Parse UI locale from merchant_reference2 (`{sellerId}|en`). */
export function uiLocaleFromMerchantRef2(
  ref: string | null | undefined
): "sv" | "en" {
  if (!ref) return "sv";
  const part = ref.split("|")[1]?.trim().toLowerCase();
  return part === "en" ? "en" : "sv";
}

export async function acknowledgeOrder(orderId: string) {
  if (!isKlarnaConfigured()) return;

  const res = await klarnaFetch(
    `${KLARNA_API_URL}/ordermanagement/v1/orders/${orderId}/acknowledge`,
    {
      method: "POST",
      headers: { Authorization: getAuthHeader() },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log.error({ orderId, status: res.status, body }, "Failed to acknowledge order");
  }
}
