import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import {
  sellers,
  teams,
  campaigns,
  products,
  customerOrders,
  customerOrderLines,
} from "@roots/db/schema";
import {
  createCheckoutSession,
  getCheckoutOrder,
  acknowledgeOrder,
} from "../lib/payments/klarna";
import { verifyKlarnaSignature } from "../lib/payments/klarna-webhook";
import { getEmailSender } from "../lib/email";
import { orderConfirmationEmail } from "../lib/email/templates";
import { childLogger } from "../lib/logger";

const log = childLogger("checkout");

export const checkout = new Hono();

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";

// Klarna production webhook IPs.
// See: https://docs.klarna.com/api/webhooks/#ip-addresses
// Populate before going live with Klarna's published IP ranges.
const KLARNA_ALLOWED_IPS = new Set(
  (process.env.KLARNA_WEBHOOK_IPS || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
);

// Shared secret used for HMAC-SHA256 verification of Klarna's push
// notifications. The verifier lives in ../lib/payments/klarna-webhook.ts
// so it can be unit-tested without touching the route.
const KLARNA_WEBHOOK_SECRET = process.env.KLARNA_WEBHOOK_SECRET || "";

checkout.post("/create", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  try {
    const {
      sellerSlug,
      customerName,
      customerEmail,
      customerPhone,
      deliveryType,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCity,
      shippingPostalCode,
      items,
      note,
    } = body;

    if (!sellerSlug || !customerName || !customerEmail || !Array.isArray(items) || !items.length) {
      return c.json({ error: "Alla obligatoriska fält krävs." }, 400);
    }

    for (const item of items) {
      if (
        !item.productId ||
        typeof item.qty !== "number" ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 100
      ) {
        return c.json({ error: "Ogiltig vara: qty måste vara ett heltal mellan 1 och 100." }, 400);
      }
    }

    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.shopSlug, sellerSlug))
      .limit(1);

    if (!seller) {
      return c.json({ error: "Säljare hittades inte." }, 404);
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);

    if (!team) {
      return c.json({ error: "Laget kunde inte hittas." }, 404);
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    if (!campaign || campaign.status !== "ACTIVE") {
      return c.json({ error: "Kampanjen är inte aktiv." }, 400);
    }

    const productList = await db.select().from(products).where(eq(products.active, true));
    const productMap = new Map(productList.map((p) => [p.id, p]));

    let totalOre = 0;
    const orderLines: Array<{
      type: "physical";
      reference: string;
      name: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
      total_amount: number;
      total_tax_amount: number;
    }> = [];

    const dbOrderLines: Array<{
      productId: string;
      qty: number;
      unitPriceOre: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return c.json({ error: `Produkt hittades inte: ${item.productId}` }, 400);
      }

      const qty = item.qty;
      const unitPrice = product.priceOre;
      const lineTotal = unitPrice * qty;
      const taxRate = 2500;
      const taxAmount = Math.round(lineTotal - lineTotal / 1.25);

      totalOre += lineTotal;
      orderLines.push({
        type: "physical",
        reference: product.sku,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        tax_rate: taxRate,
        total_amount: lineTotal,
        total_tax_amount: taxAmount,
      });

      dbOrderLines.push({
        productId: product.id,
        qty,
        unitPriceOre: unitPrice,
      });
    }

    if (dbOrderLines.length === 0 || totalOre === 0) {
      return c.json({ error: "Varukorgen är tom eller innehåller ogiltiga produkter." }, 400);
    }

    let shippingOre = 0;
    if (
      deliveryType === "DIRECT" &&
      campaign.shippingFeeOre &&
      campaign.shippingThresholdOre
    ) {
      if (totalOre < campaign.shippingThresholdOre) {
        shippingOre = campaign.shippingFeeOre;
        orderLines.push({
          type: "physical",
          reference: "SHIPPING",
          name: "Frakt",
          quantity: 1,
          unit_price: shippingOre,
          tax_rate: 2500,
          total_amount: shippingOre,
          total_tax_amount: Math.round(shippingOre - shippingOre / 1.25),
        });
        totalOre += shippingOre;
      }
    }

    const totalTax = orderLines.reduce(
      (sum, l) => sum + l.total_tax_amount,
      0
    );

    const [order] = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(customerOrders)
        .values({
          orgId: team.orgId,
          campaignId: seller.campaignId,
          teamId: seller.teamId,
          sellerId: seller.id,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          shippingAddressLine1: shippingAddressLine1 || null,
          shippingAddressLine2: shippingAddressLine2 || null,
          shippingCity: shippingCity || null,
          shippingPostalCode: shippingPostalCode || null,
          deliveryType: deliveryType || "BULK",
          paymentMethod: "KLARNA",
          status: "DRAFT",
          totalOre,
          shippingOre,
          note: note || null,
        })
        .returning();

      for (const line of dbOrderLines) {
        await tx.insert(customerOrderLines).values({
          orderId: newOrder.id,
          productId: line.productId,
          qty: line.qty,
          unitPriceOre: line.unitPriceOre,
        });
      }

      return [newOrder];
    });

    let klarnaSession;
    try {
      klarnaSession = await createCheckoutSession({
        purchaseCountry: "SE",
        purchaseCurrency: "SEK",
        locale: "sv-SE",
        orderAmount: totalOre,
        orderTaxAmount: totalTax,
        orderLines,
        merchantUrls: {
          terms: `${SITE_URL}/villkor`,
          checkout: `${SITE_URL}/shop/${sellerSlug}/kassa`,
          confirmation: `${SITE_URL}/shop/${sellerSlug}/bekraftelse?order_id=${order.id}`,
          push: `${process.env.API_URL || "http://localhost:4000"}/v1/checkout/webhook/{checkout.order.id}`,
        },
        merchantReference1: order.id,
        merchantReference2: seller.id,
      });
    } catch (klarnaErr) {
      await db
        .update(customerOrders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(customerOrders.id, order.id));

      log.error({ err: klarnaErr }, "Klarna session creation failed");
      return c.json({ error: "Betalningen kunde inte initieras." }, 502);
    }

    await db
      .update(customerOrders)
      .set({
        klarnaOrderId: klarnaSession.orderId,
        status: "PENDING",
        updatedAt: new Date(),
      })
      .where(eq(customerOrders.id, order.id));

    return c.json({
      orderId: order.id,
      klarnaOrderId: klarnaSession.orderId,
      htmlSnippet: klarnaSession.htmlSnippet,
    });
  } catch (err: any) {
    log.error({ err }, "Checkout creation failed");
    return c.json({ error: "Något gick fel vid kassan." }, 500);
  }
});

checkout.post("/webhook/:klarnaOrderId", async (c) => {
  const klarnaOrderId = c.req.param("klarnaOrderId");

  // Connection-audit P0 #3: fail-closed when neither HMAC signing nor
  // IP allowlist is configured in production. Previously this was a
  // bare endpoint that anyone could POST to and flip orders to PAID.
  const isProd = process.env.NODE_ENV === "production";
  const hasSecret = KLARNA_WEBHOOK_SECRET.length > 0;
  const hasIpAllowlist = KLARNA_ALLOWED_IPS.size > 0;

  if (isProd && !hasSecret && !hasIpAllowlist) {
    log.error(
      "Klarna webhook called in production with neither KLARNA_WEBHOOK_SECRET nor KLARNA_WEBHOOK_IPS configured — refusing"
    );
    return c.json({ error: "Webhook not configured" }, 503);
  }

  // Read the raw body up-front so we can HMAC it before parsing JSON.
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("klarna-signature") || "";

  // If a signing secret is configured, require a valid signature. The
  // signature path takes precedence over IP allowlist because spoofed
  // X-Forwarded-For is easy without HMAC.
  if (hasSecret) {
    if (!verifyKlarnaSignature(rawBody, signatureHeader, KLARNA_WEBHOOK_SECRET)) {
      log.warn(
        { hasHeader: signatureHeader.length > 0 },
        "Rejected Klarna webhook: invalid signature"
      );
      return c.json({ error: "Invalid signature" }, 401);
    }
  } else if (hasIpAllowlist) {
    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (!KLARNA_ALLOWED_IPS.has(clientIp)) {
      log.warn({ clientIp }, "Rejected webhook IP");
      return c.json({ error: "Forbidden" }, 403);
    }
  }
  // Non-prod with neither configured falls through (dev/test convenience).

  try {
    const klarnaOrder = await getCheckoutOrder(klarnaOrderId);

    if (klarnaOrder.status === "checkout_complete") {
      const [existingOrder] = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.klarnaOrderId, klarnaOrderId))
        .limit(1);

      if (existingOrder && existingOrder.status !== "PAID") {
        await db
          .update(customerOrders)
          .set({ status: "PAID", updatedAt: new Date() })
          .where(eq(customerOrders.klarnaOrderId, klarnaOrderId));

        await acknowledgeOrder(klarnaOrderId);

        const orderLines = await db
          .select({
            name: products.name,
            qty: customerOrderLines.qty,
            unitPriceOre: customerOrderLines.unitPriceOre,
          })
          .from(customerOrderLines)
          .innerJoin(products, eq(customerOrderLines.productId, products.id))
          .where(eq(customerOrderLines.orderId, existingOrder.id));

        const [seller] = await db
          .select()
          .from(sellers)
          .where(eq(sellers.id, existingOrder.sellerId))
          .limit(1);

        if (existingOrder.customerEmail) {
          getEmailSender()
            .sendEmail({
              to: existingOrder.customerEmail,
              ...orderConfirmationEmail({
                customerName: existingOrder.customerName,
                orderId: existingOrder.id,
                totalOre: existingOrder.totalOre,
                shopSlug: seller?.shopSlug || "",
                items: orderLines,
              }),
            })
            .catch((e) => log.error({ err: e }, "Order confirmation email failed"));
        }
      }
    }

    return c.json({ received: true });
  } catch (err) {
    log.error({ err }, "Webhook processing failed");
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

checkout.get("/confirm/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);

    if (!order) {
      return c.json({ error: "Order hittades inte." }, 404);
    }

    if (order.klarnaOrderId && order.status === "PENDING") {
      try {
        const klarnaOrder = await getCheckoutOrder(order.klarnaOrderId);
        if (klarnaOrder.status === "checkout_complete") {
          await db
            .update(customerOrders)
            .set({ status: "PAID", updatedAt: new Date() })
            .where(eq(customerOrders.id, orderId));

          await acknowledgeOrder(order.klarnaOrderId);
          order.status = "PAID";
        }
      } catch (klarnaErr) {
        log.error({ err: klarnaErr }, "Klarna confirmation check failed");
      }
    }

    const maskedEmail = order.customerEmail
      ? order.customerEmail.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c)
      : null;

    return c.json({
      orderId: order.id,
      status: order.status,
      totalOre: order.totalOre,
      customerName: order.customerName?.split(" ")[0] || null,
      customerEmail: maskedEmail,
    });
  } catch (err) {
    log.error({ err }, "Order confirmation failed");
    return c.json({ error: "Kunde inte bekräfta ordern." }, 500);
  }
});

checkout.get("/order-status/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);

    if (!order) {
      return c.json({ error: "Order hittades inte." }, 404);
    }

    const lines = await db
      .select({
        name: products.name,
        qty: customerOrderLines.qty,
        unitPriceOre: customerOrderLines.unitPriceOre,
      })
      .from(customerOrderLines)
      .innerJoin(products, eq(customerOrderLines.productId, products.id))
      .where(eq(customerOrderLines.orderId, orderId));

    const [seller] = order.sellerId
      ? await db
          .select({ displayName: sellers.displayName, shopSlug: sellers.shopSlug })
          .from(sellers)
          .where(eq(sellers.id, order.sellerId))
          .limit(1)
      : [null];

    return c.json({
      orderId: order.id,
      status: order.status,
      totalOre: order.totalOre,
      shippingOre: order.shippingOre,
      customerName: order.customerName?.split(" ")[0] || null,
      deliveryType: order.deliveryType,
      createdAt: order.createdAt,
      sellerName: seller?.displayName || null,
      shopSlug: seller?.shopSlug || null,
      items: lines,
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch order status");
    return c.json({ error: "Kunde inte hämta orderstatus." }, 500);
  }
});
