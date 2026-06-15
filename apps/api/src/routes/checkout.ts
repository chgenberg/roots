import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
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
import { auditLog, requestContext } from "../lib/audit";
import {
  issueOrderViewToken,
  verifyOrderViewToken,
} from "../lib/order-view-tokens";
import { checkoutCreateRateLimit } from "../lib/rate-limit";
import { wasWebhookEventSeen, clearWebhookEventSeen } from "../lib/webhook-dedup";

const log = childLogger("checkout");

export const checkout = new Hono();

// P2.26 (audit 2026-05-26): fall tillbaka på roots.se i prod så
// Klarna-confirmation-redirect inte pekar på localhost.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://roots.se"
    : "http://localhost:3003")
).replace(/\/$/, "");

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

/**
 * MASTERPLAN_01 KC1.7 + P2.17 (audit 2026-05-26): order-confirmation
 * måste skickas oavsett om PAID-transitionen sker via Klarna-webhook
 * eller /confirm-polling, men aldrig dubbelt — inte ens med två
 * API-replicas som race:ar på samma PAID-händelse.
 *
 * Tidigare gjordes dedup av en process-local Set vilket inte
 * skyddade mot andra processer. Nu gör vi en konditional UPDATE
 * `SET confirmation_email_sent_at = now() WHERE id = $1 AND
 * confirmation_email_sent_at IS NULL` och skickar bara mailet om
 * raden ändrades. Det är atomiskt över processer.
 */
async function sendOrderConfirmationIfNeeded(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(customerOrders)
    .where(eq(customerOrders.id, orderId))
    .limit(1);
  if (!order || !order.customerEmail) return;
  if (order.status !== "PAID" && order.status !== "CONFIRMED") return;
  if (order.confirmationEmailSentAt) return;

  // P2.17: atomisk "ta first dibs på mailet". Det är OK att vi sätter
  // sent_at innan mailet faktiskt går iväg — alternativet (sätt efter)
  // race:ar dubbelmail om båda replicas hinner select:a.
  //
  // Scout fix 2026-05-26 (DB HIGH-002): claim:en sparas så att vi vid
  // send-failure kan rollback:a EXAKT den här claim:en (WHERE
  // confirmation_email_sent_at = claimedAt) istället för att blint
  // sätta NULL och clobbra en eventuell parallell successfull claim.
  const claimedAt = new Date();
  const claimed = await db
    .update(customerOrders)
    .set({ confirmationEmailSentAt: claimedAt })
    .where(
      and(
        eq(customerOrders.id, orderId),
        isNull(customerOrders.confirmationEmailSentAt)
      )
    )
    .returning({ id: customerOrders.id });
  if (claimed.length === 0) return;

  const orderLines = await db
    .select({
      name: products.name,
      qty: customerOrderLines.qty,
      unitPriceOre: customerOrderLines.unitPriceOre,
    })
    .from(customerOrderLines)
    .innerJoin(products, eq(customerOrderLines.productId, products.id))
    .where(eq(customerOrderLines.orderId, order.id));

  const [seller] = await db
    .select()
    .from(sellers)
    .where(eq(sellers.id, order.sellerId))
    .limit(1);
  try {
    const result = await getEmailSender().sendEmail({
      to: order.customerEmail,
      ...orderConfirmationEmail({
        customerName: order.customerName,
        orderId: order.id,
        totalOre: order.totalOre,
        shopSlug: seller?.shopSlug || "",
        items: orderLines,
        // P1.5: signera order-status-länken så den inte är åtkomlig
        // för någon annan än mailmottagaren.
        viewToken: issueOrderViewToken(order.id),
      }),
    });
    if (!result?.success) {
      throw new Error(result?.error || "Email provider returned success=false");
    }
  } catch (err) {
    // P2.17: vid send-failure, rollback:a vår claim så att en retry
    // kan försöka igen. Scout fix 2026-05-26 (DB HIGH-002): jämför mot
    // exakt claimedAt så vi inte skriver över en parallell successfull
    // claim (annars skickas mailet två gånger).
    await db
      .update(customerOrders)
      .set({ confirmationEmailSentAt: null })
      .where(
        and(
          eq(customerOrders.id, order.id),
          eq(customerOrders.confirmationEmailSentAt, claimedAt)
        )
      )
      .catch(() => {});
    log.error({ err, orderId }, "Order confirmation email failed");
  }

  // Scout fix 2026-05-26 (Integration CRIT-email): tidigare hanterades
  // sendEmail() som "lyckad" så länge den inte kastade. MockEmailSender
  // returnerar { success: true } även när inget skickas, och Resend
  // returnerar { success: false } vid 4xx/5xx istället för att kasta.
  // Vi måste explicit kontrollera result.success annars rullas claim:en
  // inte tillbaka och kunden får aldrig sitt kvitto.
}

checkout.post("/create", async (c) => {
  // P2.42 (audit 2026-05-26): rate-limit publika checkout-create.
  // 60/h/IP är generöst för familjedelad WiFi men stoppar abuse.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkoutCreateRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många kassa-försök från denna IP. Försök igen om en stund." },
      429
    );
  }

  // Vi behöver raw body för att bygga idempotency-nyckeln (P2.13)
  // och får inte konsumera streamen två gånger.
  const rawBody = await c.req.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  // P2.13 (audit 2026-05-26): klient-skickad Idempotency-Key (RFC-stil)
  // eller fallback till hash av request body. Två POST /create från
  // samma klient med samma nyckel returnerar exakt samma order utan
  // att spawn:a en ny Klarna-session.
  //
  // Scout fix 2026-05-26 (DB CRIT-001 / Money MONEY-001+002): tidigare
  // var idempotency-nyckeln helt klient-styrd och global över hela
  // tabellen. Två olika kunder bakom samma CDN/proxy som råkade
  // återanvända en `Idempotency-Key`-header fick FEL kunds order +
  // viewToken. Vi scope:ar nu nyckeln per säljare och hashar in
  // body-fingerprint så samma key + olika body blir olika rader.
  // Vid hit dubbel-validerar vi dessutom att body-fingerprint matchar.
  const sellerSlugRaw = typeof body?.sellerSlug === "string" ? body.sellerSlug : "";
  const sellerSlugLower = sellerSlugRaw.toLowerCase().trim();
  if (!sellerSlugLower) {
    return c.json({ error: "sellerSlug krävs." }, 400);
  }
  const bodyFingerprint = createHash("sha256").update(rawBody).digest("hex");
  const headerKey = c.req.header("idempotency-key")?.trim() ?? "";
  const idempotencyKey = (
    headerKey.length > 0
      ? `${sellerSlugLower}:${createHash("sha256")
          .update(`${headerKey}:${bodyFingerprint}`)
          .digest("hex")}`
      : bodyFingerprint
  ).slice(0, 120);

  try {
    // Snabbcheck: finns en order redan med denna nyckel? Returnera den
    // utan att skapa något nytt — men först verifiera att den faktiskt
    // hör ihop med den här requesten (samma seller + customer-email).
    const [existingByKey] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existingByKey) {
      const requestEmail =
        typeof body?.customerEmail === "string"
          ? body.customerEmail.toLowerCase().trim()
          : "";
      const storedEmail = (existingByKey.customerEmail ?? "").toLowerCase();
      if (storedEmail && requestEmail && storedEmail !== requestEmail) {
        // Body+seller blir identiska för hash-fallback men kan teoretiskt
        // kollidera vid header-key + samma seller. Bättre returnera
        // 409 än att läcka en annan kunds viewToken/order.
        return c.json(
          {
            error:
              "Idempotency-Key används redan av en annan request. Använd ett unikt värde.",
          },
          409
        );
      }
      return c.json({
        orderId: existingByKey.id,
        klarnaOrderId: existingByKey.klarnaOrderId,
        // htmlSnippet kan vi inte återhämta från Klarna utan ett nytt
        // session-anrop; klienten kan poll:a /confirm för status.
        htmlSnippet: null,
        viewToken: issueOrderViewToken(existingByKey.id),
        idempotent: true,
      });
    }

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

    // MASTERPLAN_01 KC4.3: validera e-postformat innan vi skapar order /
    // skickar till Klarna. Tidigare accepterades "foo" → bekräftelse-
    // mail studsar tyst och supportern får aldrig kvitto.
    const trimmedEmail = String(customerEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 254) {
      return c.json({ error: "Ogiltig e-postadress." }, 400);
    }

    // MASTERPLAN_01 KC4.3: vid DIRECT-leverans MÅSTE adress, postnummer
    // och ort finnas. Tidigare accepterades null på alla tre →
    // Klarna-ordern skapades men varan kunde inte skickas. Vi blockerar
    // INNAN Klarna anropas så ingen fastnar i halv-betalt limbo.
    if (deliveryType === "DIRECT") {
      const missing: string[] = [];
      if (!shippingAddressLine1 || String(shippingAddressLine1).trim().length < 2) {
        missing.push("adress");
      }
      if (!shippingCity || String(shippingCity).trim().length < 2) {
        missing.push("ort");
      }
      // Svenska postnummer: 5 siffror (med eller utan mellanslag)
      const pc = String(shippingPostalCode || "").replace(/\s+/g, "");
      if (!/^\d{5}$/.test(pc)) {
        missing.push("postnummer");
      }
      if (missing.length > 0) {
        return c.json(
          {
            error: `Vid hemleverans måste ${missing.join(", ")} fyllas i.`,
            fields: Object.fromEntries(missing.map((f) => [f, "obligatorisk"])),
          },
          400
        );
      }
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

    // P2.12 (audit 2026-05-26): tidigare accepterades order även om
    // säljaren satts till INACTIVE (avslutad/avstängd). Spegla den
    // public seller-profilen som redan döljer shoppen.
    if (seller.status !== "ACTIVE") {
      return c.json(
        { error: "Säljaren tar inte längre emot beställningar." },
        410
      );
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

    // Säljperiod: jämför dagens datum (YYYY-MM-DD) mot kampanjens
    // start/slut. `date`-kolumnerna kommer tillbaka som ISO-strängar så
    // lexikografisk jämförelse är korrekt.
    const todayStr = new Date().toISOString().slice(0, 10);
    const withinPeriod =
      campaign.startDate <= todayStr && todayStr <= campaign.endDate;
    if (!withinPeriod && !campaign.allowSalesOutsidePeriod) {
      // Föreningen har stängt försäljning mellan perioderna.
      return c.json(
        {
          error:
            "Försäljningsperioden är inte aktiv just nu. Beställningar tas emot under angiven säljperiod.",
        },
        400
      );
    }
    // Ordrar utanför perioden tas emot men räknas inte i topplistor.
    const countsTowardStats = withinPeriod;

    // Fraktansvar: validera att vald leveranstyp ryms i kampanjens
    // inställning. BULK = klubben tar frakt (samlad leverans), DIRECT =
    // köparen tar frakt (hemleverans). BOTH tillåter båda.
    const requestedDelivery = deliveryType === "DIRECT" ? "DIRECT" : "BULK";
    if (
      campaign.deliveryType !== "BOTH" &&
      campaign.deliveryType !== requestedDelivery
    ) {
      return c.json(
        {
          error:
            campaign.deliveryType === "BULK"
              ? "Den här kampanjen levererar samlat till föreningen — hemleverans är inte tillgänglig."
              : "Den här kampanjen kräver hemleverans till köparen.",
        },
        400
      );
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

    // MASTERPLAN_01 KC4.3: normalisera adress-fält så databasen aldrig
    // får t.ex. "  112 34  " — försämrar både matchning, Fortnox-export
    // och Klarna-validering.
    const normAddr = (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    const normPostal = (v: unknown) =>
      typeof v === "string" ? v.replace(/\s+/g, "").trim() || null : null;

    let order: typeof customerOrders.$inferSelect;
    try {
      const [created] = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(customerOrders)
          .values({
            orgId: team.orgId,
            campaignId: seller.campaignId,
            teamId: seller.teamId,
            sellerId: seller.id,
            customerName: String(customerName).trim(),
            customerEmail: trimmedEmail.toLowerCase(),
            customerPhone: customerPhone ? String(customerPhone).trim() : null,
            shippingAddressLine1: normAddr(shippingAddressLine1),
            shippingAddressLine2: normAddr(shippingAddressLine2),
            shippingCity: normAddr(shippingCity),
            shippingPostalCode: normPostal(shippingPostalCode),
            deliveryType: requestedDelivery,
            paymentMethod: "KLARNA",
            status: "DRAFT",
            totalOre,
            shippingOre,
            countsTowardStats,
            note: note ? String(note).trim() : null,
            idempotencyKey,
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
      order = created;
    } catch (err: any) {
      // P2.13: kollision på unique(idempotencyKey) — en parallell
      // request har precis vunnit racet. Returnera den befintliga.
      //
      // Scout fix 2026-05-26 (DB CRIT-001): efter vi scope:ar nyckeln
      // till sellerSlug+body-hash är kollisioner nu nästan alltid
      // legitima retries från samma klient. Vi verifierar ändå att
      // email matchar innan vi returnerar viewToken — defense-in-depth.
      const isUniqueViolation =
        err?.code === "23505" || /unique/i.test(String(err?.message));
      if (isUniqueViolation) {
        const [winner] = await db
          .select()
          .from(customerOrders)
          .where(eq(customerOrders.idempotencyKey, idempotencyKey))
          .limit(1);
        if (winner) {
          const reqEmail =
            typeof body?.customerEmail === "string"
              ? body.customerEmail.toLowerCase().trim()
              : "";
          const storedEmail = (winner.customerEmail ?? "").toLowerCase();
          if (storedEmail && reqEmail && storedEmail !== reqEmail) {
            return c.json(
              {
                error:
                  "Idempotency-Key används redan av en annan request. Använd ett unikt värde.",
              },
              409
            );
          }
          return c.json({
            orderId: winner.id,
            klarnaOrderId: winner.klarnaOrderId,
            htmlSnippet: null,
            viewToken: issueOrderViewToken(winner.id),
            idempotent: true,
          });
        }
      }
      throw err;
    }

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

      // MASTERPLAN_01 KC8.4: audit-log failed checkout-creation så ops
      // kan se i admin om Klarna-staging är nere utan att läsa pino-logs.
      void auditLog({
        userId: null,
        action: "order.failed",
        entityType: "customer_order",
        entityId: order.id,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          reason: "klarna_session_creation_failed",
          orgId: team.orgId,
          totalOre,
        },
      });

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

    // MASTERPLAN_01 KC8.4: order.created — den verkliga "checkout
    // initierad"-händelsen (inte DB-INSERT, eftersom DRAFT-rader rensas
    // av Klarna-failure ovan). Säljarens user-id loggas i meta så vi
    // kan svara "hur många orders gjorde Anna förra helgen?" via en
    // ren audit-fråga utan att joina customer_orders.
    void auditLog({
      userId: null,
      action: "order.created",
      entityType: "customer_order",
      entityId: order.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        orgId: team.orgId,
        sellerId: seller.id,
        campaignId: seller.campaignId,
        klarnaOrderId: klarnaSession.orderId,
        totalOre,
        itemCount: dbOrderLines.length,
      },
    });

    return c.json({
      orderId: order.id,
      klarnaOrderId: klarnaSession.orderId,
      htmlSnippet: klarnaSession.htmlSnippet,
      // P1.5: ge frontend en token så bekräftelse-sidan kan länka
      // vidare till `/shop/[slug]/order/[orderId]?t=…` utan att
      // exponera /order-status öppet.
      viewToken: issueOrderViewToken(order.id),
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
  // P2.19 (audit 2026-05-26): tidigare föll dev/test igenom med en
  // helt öppen endpoint. En forskare/scanner som råkar pinga staging
  // kunde flippa orders till PAID. Kräv explicit opt-in om man vill
  // ha öppen webhook utanför prod.
  const devAllowUnsigned = process.env.ROOTS_ALLOW_UNSIGNED_KLARNA_WEBHOOK === "true";

  if (!hasSecret && !hasIpAllowlist) {
    if (isProd) {
      log.error(
        "Klarna webhook called in production with neither KLARNA_WEBHOOK_SECRET nor KLARNA_WEBHOOK_IPS configured — refusing"
      );
      return c.json({ error: "Webhook not configured" }, 503);
    }
    if (!devAllowUnsigned) {
      log.warn(
        "Klarna webhook hit in non-prod without secret/IP allowlist and without ROOTS_ALLOW_UNSIGNED_KLARNA_WEBHOOK=true — refusing"
      );
      return c.json({ error: "Webhook not configured" }, 503);
    }
  }

  // Read the raw body up-front so we can HMAC it before parsing JSON.
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("klarna-signature") || "";

  // P2.18 (audit 2026-05-26): om båda mekanismerna är konfigurerade
  // ska BÅDA passera — inte "OR". Det matchar defense-in-depth-
  // intentionen: HMAC stoppar spoofed X-Forwarded-For och IP-listan
  // stoppar lyckad nyckelkomprimering. Om bara en är konfigurerad
  // räcker den (tidigare beteende).
  if (hasSecret) {
    if (!verifyKlarnaSignature(rawBody, signatureHeader, KLARNA_WEBHOOK_SECRET)) {
      log.warn(
        { hasHeader: signatureHeader.length > 0 },
        "Rejected Klarna webhook: invalid signature"
      );
      return c.json({ error: "Invalid signature" }, 401);
    }
  }
  if (hasIpAllowlist) {
    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (!KLARNA_ALLOWED_IPS.has(clientIp)) {
      log.warn({ clientIp }, "Rejected webhook IP");
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  // P3.43 (audit 2026-05-26): Klarna ger oss inget eventId i payload,
  // men signaturen är HMAC av body så unik per delivery. Med fallback
  // till SHA256(body) om signaturen saknas. 24h TTL räcker — Klarna
  // ger upp retry-stormar långt innan dess. Saves the duplicate
  // getCheckoutOrder() round-trip när Klarna pushar samma event 3-4
  // gånger innan vi hinner svara 200.
  const dedupKey = signatureHeader
    ? `${klarnaOrderId}:${signatureHeader}`
    : `${klarnaOrderId}:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
  if (await wasWebhookEventSeen("klarna", dedupKey)) {
    return c.json({ received: true, duplicate: true });
  }

  // Pre-push fix 2026-05-26: tidigare implementation markerade dedup-
  // keyen INNAN bearbetning. Vid 5xx fastnade ordern i evig "duplicate"-
  // loop eftersom Klarnas retries klassades som dups utan att vi
  // någonsin lyckats processa. Tag/track om vi har "consumed" keyen
  // så vi kan släppa den i catch-blocket vid fel.
  let dedupConsumed = true;

  try {
    const klarnaOrder = await getCheckoutOrder(klarnaOrderId);

    if (klarnaOrder.status === "checkout_complete") {
      const [existingOrder] = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.klarnaOrderId, klarnaOrderId))
        .limit(1);

      if (!existingOrder) {
        return c.json({ received: true });
      }

      // P1.3 (audit 2026-05-26): verifiera att Klarna verkligen
      // capturerade det belopp vi tror att ordern är värd. Tidigare
      // räckte status === "checkout_complete" — en mismatch (manuell
      // ändring i Klarna, race, kompromettat snippet) skulle flytas
      // rakt in i settlement utan att någon märkte det.
      if (
        klarnaOrder.orderAmount !== null &&
        klarnaOrder.orderAmount !== existingOrder.totalOre
      ) {
        log.error(
          {
            orderId: existingOrder.id,
            klarnaOrderId,
            klarnaAmount: klarnaOrder.orderAmount,
            klarnaCurrency: klarnaOrder.purchaseCurrency,
            expectedAmount: existingOrder.totalOre,
          },
          "Klarna order_amount mismatch — refusing PAID transition"
        );
        if (existingOrder.status === "PENDING") {
          await db
            .update(customerOrders)
            .set({ status: "FAILED", updatedAt: new Date() })
            .where(
              and(
                eq(customerOrders.id, existingOrder.id),
                eq(customerOrders.status, "PENDING")
              )
            );
        }
        void auditLog({
          userId: null,
          action: "order.failed",
          entityType: "customer_order",
          entityId: existingOrder.id,
          meta: {
            ...requestContext((n) => c.req.header(n)),
            reason: "klarna_amount_mismatch",
            source: "klarna_webhook",
            klarnaOrderId,
            klarnaAmountOre: klarnaOrder.orderAmount,
            klarnaCurrency: klarnaOrder.purchaseCurrency,
            expectedAmountOre: existingOrder.totalOre,
            orgId: existingOrder.orgId,
          },
        });
        return c.json({ error: "Amount mismatch" }, 409);
      }

      if (
        klarnaOrder.purchaseCurrency &&
        klarnaOrder.purchaseCurrency !== "SEK"
      ) {
        log.error(
          { orderId: existingOrder.id, currency: klarnaOrder.purchaseCurrency },
          "Klarna currency mismatch — refusing PAID transition"
        );
        return c.json({ error: "Currency mismatch" }, 409);
      }

      // P1.3 + audit 2.14/2.15: konditional UPDATE så bara PENDING
      // → PAID går igenom. FAILED/CANCELLED/REFUNDED kan därmed
      // inte längre flippas tillbaka till PAID av en sen Klarna-push.
      const updated = await db
        .update(customerOrders)
        .set({
          status: "PAID",
          selectedPaymentMethod: klarnaOrder.selectedPaymentMethod,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerOrders.klarnaOrderId, klarnaOrderId),
            eq(customerOrders.status, "PENDING")
          )
        )
        .returning({ id: customerOrders.id });

      if (updated.length === 0) {
        // Antingen redan PAID (idempotent retry) eller i ett status
        // vi inte vill flippa från (FAILED/CANCELLED/REFUNDED).
        // Båda är inte fel — vi ack:ar Klarna ändå för att stoppa
        // retry-stormen, men hoppar audit + email.
        await acknowledgeOrder(klarnaOrderId);
        return c.json({ received: true });
      }

      await acknowledgeOrder(klarnaOrderId);

      // MASTERPLAN_01 KC8.4: definitiv "pengar in"-händelse. Loggas
      // även från /confirm-pollingen nedan — `source`-meta skiljer
      // dem åt så vi kan se hur ofta webhooks faktiskt landar i tid
      // vs hur ofta vi räddar oss via polling.
      void auditLog({
        userId: null,
        action: "order.paid",
        entityType: "customer_order",
        entityId: existingOrder.id,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          source: "klarna_webhook",
          klarnaOrderId,
          orgId: existingOrder.orgId,
          totalOre: existingOrder.totalOre,
          klarnaAmountOre: klarnaOrder.orderAmount,
        },
      });

      // Fire-and-forget; helpern är idempotent och loggar internt.
      sendOrderConfirmationIfNeeded(existingOrder.id).catch(() => {});
    }

    return c.json({ received: true });
  } catch (err) {
    log.error({ err }, "Webhook processing failed");
    // Pre-push fix 2026-05-26: släpp dedup-keyen så Klarnas retry kan
    // göra ett nytt försök. Annars sitter ordern fast i 24h.
    if (dedupConsumed) {
      await clearWebhookEventSeen("klarna", dedupKey);
    }
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
          // P1.3: samma amount + currency-gate som i webhook-pathen
          // ovan. Polling kan inte heller släppa förbi orders där
          // Klarna säger en annan summa än vi räknade ut lokalt.
          if (
            klarnaOrder.orderAmount !== null &&
            klarnaOrder.orderAmount !== order.totalOre
          ) {
            log.error(
              {
                orderId: order.id,
                klarnaOrderId: order.klarnaOrderId,
                klarnaAmount: klarnaOrder.orderAmount,
                expectedAmount: order.totalOre,
              },
              "Klarna order_amount mismatch on confirm polling — refusing PAID transition"
            );
            await db
              .update(customerOrders)
              .set({ status: "FAILED", updatedAt: new Date() })
              .where(
                and(
                  eq(customerOrders.id, orderId),
                  eq(customerOrders.status, "PENDING")
                )
              );
            order.status = "FAILED";
            void auditLog({
              userId: null,
              action: "order.failed",
              entityType: "customer_order",
              entityId: order.id,
              meta: {
                ...requestContext((n) => c.req.header(n)),
                reason: "klarna_amount_mismatch",
                source: "confirm_polling",
                klarnaOrderId: order.klarnaOrderId,
                klarnaAmountOre: klarnaOrder.orderAmount,
                expectedAmountOre: order.totalOre,
                orgId: order.orgId,
              },
            });
          } else if (
            klarnaOrder.purchaseCurrency &&
            klarnaOrder.purchaseCurrency !== "SEK"
          ) {
            log.error(
              { orderId: order.id, currency: klarnaOrder.purchaseCurrency },
              "Klarna currency mismatch on confirm polling — refusing PAID transition"
            );
          } else {
            const updated = await db
              .update(customerOrders)
              .set({
                status: "PAID",
                selectedPaymentMethod: klarnaOrder.selectedPaymentMethod,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(customerOrders.id, orderId),
                  eq(customerOrders.status, "PENDING")
                )
              )
              .returning({ id: customerOrders.id });

            if (updated.length > 0) {
              await acknowledgeOrder(order.klarnaOrderId);
              order.status = "PAID";

              // MASTERPLAN_01 KC8.4: audit också från polling-pathen.
              // source="confirm_polling" gör att vi kan mäta webhook-
              // reliability i prod genom att räkna paid-rader per source.
              void auditLog({
                userId: null,
                action: "order.paid",
                entityType: "customer_order",
                entityId: order.id,
                meta: {
                  ...requestContext((n) => c.req.header(n)),
                  source: "confirm_polling",
                  klarnaOrderId: order.klarnaOrderId,
                  orgId: order.orgId,
                  totalOre: order.totalOre,
                  klarnaAmountOre: klarnaOrder.orderAmount,
                },
              });
            }
          }
        }
      } catch (klarnaErr) {
        log.error({ err: klarnaErr }, "Klarna confirmation check failed");
      }
    }

    // MASTERPLAN_01 KC1.7: skicka bekräftelse även när PAID nås via
    // polling-path (webhook kan ha blockats av nätverk/CSRF/IP-listan).
    // Helpern är idempotent — dubbla mail vid race är förebyggda.
    if (order.status === "PAID" || order.status === "CONFIRMED") {
      sendOrderConfirmationIfNeeded(order.id).catch(() => {});
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
      // P1.5: även /confirm utfärdar token så bekraftelse-sidan kan
      // skicka kunden vidare till en låst order-status-vy.
      viewToken: issueOrderViewToken(order.id),
    });
  } catch (err) {
    log.error({ err }, "Order confirmation failed");
    return c.json({ error: "Kunde inte bekräfta ordern." }, 500);
  }
});

checkout.get("/order-status/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  // P1.5 (audit 2026-05-26): endpointen returnerade tidigare full
  // kund-PII till alla som kände till UUID:n. Vi kräver nu en
  // signerad token (`?t=…`) som vi själva utfärdar vid checkout-
  // create + i bekräftelse-mailet. Token är HMAC(orderId|exp) så
  // den binder till en specifik order och kan inte återanvändas.
  const token = c.req.query("t");
  if (!verifyOrderViewToken(orderId, token)) {
    log.warn({ orderId, hasToken: Boolean(token) }, "order-status rejected: invalid token");
    return c.json({ error: "Ogiltig eller utgången länk." }, 401);
  }

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
