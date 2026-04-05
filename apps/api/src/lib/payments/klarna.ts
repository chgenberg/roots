import { childLogger } from "../logger";

const log = childLogger("klarna");

const KLARNA_API_URL =
  process.env.KLARNA_ENV === "production"
    ? "https://api.klarna.com"
    : "https://api.playground.klarna.com";

const KLARNA_USERNAME = process.env.KLARNA_USERNAME || "";
const KLARNA_PASSWORD = process.env.KLARNA_PASSWORD || "";

function getAuthHeader(): string {
  return (
    "Basic " + Buffer.from(`${KLARNA_USERNAME}:${KLARNA_PASSWORD}`).toString("base64")
  );
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

  const res = await fetch(`${KLARNA_API_URL}/checkout/v3/orders`, {
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

export async function getCheckoutOrder(orderId: string) {
  if (!isKlarnaConfigured()) {
    return {
      orderId,
      status: "checkout_complete",
      billingAddress: {
        given_name: "Test",
        family_name: "Testsson",
        email: "test@test.se",
      },
    };
  }

  const res = await fetch(
    `${KLARNA_API_URL}/checkout/v3/orders/${orderId}`,
    {
      headers: { Authorization: getAuthHeader() },
    }
  );

  if (!res.ok) {
    throw new Error(`Klarna order fetch failed: ${res.status}`);
  }

  return res.json();
}

export async function acknowledgeOrder(orderId: string) {
  if (!isKlarnaConfigured()) return;

  const res = await fetch(
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
