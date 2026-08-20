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
  getCheckoutSession,
  getCheckoutUrl,
  constructStripeEvent,
  snapshotFromWebhookEvent,
  isStripePaidEvent,
  isStripeFailEvent,
  type StripeSessionSnapshot,
} from "../lib/payments/stripe";
import {
  localizedProductName,
  shippingLineName,
} from "../lib/product-i18n";
import { getEmailSender } from "../lib/email";
import { orderConfirmationEmail } from "../lib/email/templates";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import {
  issueOrderViewToken,
  verifyOrderViewToken,
} from "../lib/order-view-tokens";
import { checkoutCreateRateLimit } from "../lib/rate-limit";
import { resolveCampaignCatalog } from "../lib/campaign-catalog";
import { isOrgApprovedForPublicSales } from "../lib/org-approval";
import {
  VAT_RATE_BASIS_POINTS,
  vatOfGrossOre,
  TERMS_VERSION,
} from "@roots/contracts";
import { stockholmDateIso } from "../lib/date";
import { wasWebhookEventSeen, clearWebhookEventSeen } from "../lib/webhook-dedup";
import {
  resolveUiLocale,
  uiError,
  uiErrorFill,
  type UiLocale,
} from "../lib/ui-locale";

const log = childLogger("checkout");

export const checkout = new Hono();

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://roots.nu"
    : "http://localhost:3004")
).replace(/\/$/, "");

/**
 * MASTERPLAN_01 KC1.7 + P2.17 (audit 2026-05-26): order-confirmation
 * måste skickas oavsett om PAID-transitionen sker via Stripe-webhook
 * eller /confirm-polling, men aldrig dubbelt — inte ens med två
 * API-replicas som race:ar på samma PAID-händelse.
 *
 * Tidigare gjordes dedup av en process-local Set vilket inte
 * skyddade mot andra processer. Nu gör vi en konditional UPDATE
 * `SET confirmation_email_sent_at = now() WHERE id = $1 AND
 * confirmation_email_sent_at IS NULL` och skickar bara mailet om
 * raden ändrades. Det är atomiskt över processer.
 */
async function sendOrderConfirmationIfNeeded(
  orderId: string,
  locale: UiLocale = "sv"
): Promise<void> {
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
      slug: products.slug,
      sku: products.sku,
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
        items: orderLines.map((l) => ({
          name: localizedProductName(locale, {
            slug: l.slug,
            sku: l.sku,
            fallback: l.name,
          }),
          qty: l.qty,
          unitPriceOre: l.unitPriceOre,
        })),
        // P1.5: signera order-status-länken så den inte är åtkomlig
        // för någon annan än mailmottagaren.
        viewToken: issueOrderViewToken(order.id),
        locale,
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

async function markOrderPaidFromStripe(opts: {
  order: typeof customerOrders.$inferSelect;
  snapshot: StripeSessionSnapshot;
  source: "stripe_webhook" | "confirm_polling";
  header: (n: string) => string | undefined;
}): Promise<"paid" | "already" | "mismatch"> {
  const { order, snapshot, source, header } = opts;

  if (
    snapshot.amountTotalOre !== null &&
    snapshot.amountTotalOre !== order.totalOre
  ) {
    log.error(
      {
        orderId: order.id,
        stripeAmount: snapshot.amountTotalOre,
        expectedAmount: order.totalOre,
        source,
      },
      "Stripe amount mismatch — refusing PAID transition"
    );
    if (order.status === "PENDING") {
      await db
        .update(customerOrders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(
          and(
            eq(customerOrders.id, order.id),
            eq(customerOrders.status, "PENDING")
          )
        );
    }
    void auditLog({
      userId: null,
      action: "order.failed",
      entityType: "customer_order",
      entityId: order.id,
      meta: {
        ...requestContext(header),
        reason: "stripe_amount_mismatch",
        source,
        stripeSessionId: snapshot.sessionId,
        stripeAmountOre: snapshot.amountTotalOre,
        expectedAmountOre: order.totalOre,
        orgId: order.orgId,
      },
    });
    return "mismatch";
  }

  if (snapshot.currency && snapshot.currency !== "SEK") {
    log.error(
      { orderId: order.id, currency: snapshot.currency, source },
      "Stripe currency mismatch — refusing PAID transition"
    );
    return "mismatch";
  }

  const updated = await db
    .update(customerOrders)
    .set({
      status: "PAID",
      selectedPaymentMethod: snapshot.selectedPaymentMethod,
      updatedAt: new Date(),
    })
    .where(
      and(eq(customerOrders.id, order.id), eq(customerOrders.status, "PENDING"))
    )
    .returning({ id: customerOrders.id });

  if (updated.length === 0) return "already";

  void auditLog({
    userId: null,
    action: "order.paid",
    entityType: "customer_order",
    entityId: order.id,
    meta: {
      ...requestContext(header),
      source,
      stripeSessionId: snapshot.sessionId,
      orgId: order.orgId,
      totalOre: order.totalOre,
      stripeAmountOre: snapshot.amountTotalOre,
    },
  });

  sendOrderConfirmationIfNeeded(order.id, snapshot.locale).catch(() => {});
  return "paid";
}

async function markOrderFailedFromStripe(opts: {
  order: typeof customerOrders.$inferSelect;
  snapshot: StripeSessionSnapshot;
  source: "stripe_webhook" | "confirm_polling";
  reason: "stripe_expired" | "stripe_payment_failed";
  header: (n: string) => string | undefined;
}): Promise<"failed" | "already"> {
  const { order, snapshot, source, reason, header } = opts;
  if (order.status !== "PENDING") return "already";

  const updated = await db
    .update(customerOrders)
    .set({ status: "FAILED", updatedAt: new Date() })
    .where(
      and(eq(customerOrders.id, order.id), eq(customerOrders.status, "PENDING"))
    )
    .returning({ id: customerOrders.id });

  if (updated.length === 0) return "already";

  void auditLog({
    userId: null,
    action: "order.failed",
    entityType: "customer_order",
    entityId: order.id,
    meta: {
      ...requestContext(header),
      reason,
      source,
      stripeSessionId: snapshot.sessionId,
      orgId: order.orgId,
    },
  });
  return "failed";
}

async function findOrderForStripeSession(
  snapshot: StripeSessionSnapshot
): Promise<typeof customerOrders.$inferSelect | null> {
  const [bySession] = await db
    .select()
    .from(customerOrders)
    .where(eq(customerOrders.stripeCheckoutSessionId, snapshot.sessionId))
    .limit(1);
  if (bySession) return bySession;

  if (!snapshot.orderId) return null;
  const [byOrder] = await db
    .select()
    .from(customerOrders)
    .where(eq(customerOrders.id, snapshot.orderId))
    .limit(1);
  if (!byOrder) return null;
  if (
    byOrder.stripeCheckoutSessionId &&
    byOrder.stripeCheckoutSessionId !== snapshot.sessionId
  ) {
    return null;
  }
  return byOrder;
}

checkout.post("/create", async (c) => {
  // P2.42 (audit 2026-05-26): rate-limit publika checkout-create.
  // 60/h/IP är generöst för familjedelad WiFi men stoppar abuse.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkoutCreateRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "checkoutRateLimited") },
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
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }

  const locale = resolveUiLocale(c, body?.locale);
  const localePrefix = locale === "en" ? "/en" : "";


  // P2.13 (audit 2026-05-26): klient-skickad Idempotency-Key (RFC-stil)
  // eller fallback till hash av request body. Två POST /create från
  // samma klient med samma nyckel returnerar exakt samma order utan
  // att spawn:a en ny Stripe-session.
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
    return c.json({ error: uiError(locale, "sellerSlugRequired") }, 400);
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
              uiError(locale, "idempotencyConflict"),
          },
          409
        );
      }
      const existingUrl = existingByKey.stripeCheckoutSessionId
        ? await getCheckoutUrl(existingByKey.stripeCheckoutSessionId)
        : null;
      return c.json({
        orderId: existingByKey.id,
        stripeSessionId: existingByKey.stripeCheckoutSessionId,
        checkoutUrl: existingUrl,
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
      return c.json({ error: uiError(locale, "requiredFields") }, 400);
    }

    // Distansavtalslagen kräver ett aktivt godkännande före köp. Kryssrutan
    // fanns i kassan men kontrollerades bara i klienten och sparades aldrig,
    // så vi kunde inte visa vad kunden faktiskt godkände.
    if (body?.acceptTerms !== true) {
      return c.json(
        { error: uiError(locale, "mustAcceptTerms") },
        400
      );
    }

    // MASTERPLAN_01 KC4.3: validera e-postformat innan vi skapar order /
    // skickar till Stripe. Tidigare accepterades "foo" → bekräftelse-
    // mail studsar tyst och supportern får aldrig kvitto.
    const trimmedEmail = String(customerEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 254) {
      return c.json({ error: uiError(locale, "invalidEmail") }, 400);
    }

    // MASTERPLAN_01 KC4.3: vid DIRECT-leverans MÅSTE adress, postnummer
    // och ort finnas. Tidigare accepterades null på alla tre →
    // Stripe-sessionen skapades men varan kunde inte skickas. Vi blockerar
    // INNAN Stripe anropas så ingen fastnar i halv-betalt limbo.
    if (deliveryType === "DIRECT") {
      const missingKeys: Array<"fieldAddress" | "fieldCity" | "fieldPostalCode"> =
        [];
      if (!shippingAddressLine1 || String(shippingAddressLine1).trim().length < 2) {
        missingKeys.push("fieldAddress");
      }
      if (!shippingCity || String(shippingCity).trim().length < 2) {
        missingKeys.push("fieldCity");
      }
      // Svenska postnummer: 5 siffror (med eller utan mellanslag)
      const pc = String(shippingPostalCode || "").replace(/\s+/g, "");
      if (!/^\d{5}$/.test(pc)) {
        missingKeys.push("fieldPostalCode");
      }
      if (missingKeys.length > 0) {
        const fieldLabels = missingKeys.map((k) => uiError(locale, k));
        const fieldKeys =
          locale === "en"
            ? missingKeys.map((k) =>
                k === "fieldAddress"
                  ? "address"
                  : k === "fieldCity"
                    ? "city"
                    : "postalCode"
              )
            : missingKeys.map((k) =>
                k === "fieldAddress"
                  ? "adress"
                  : k === "fieldCity"
                    ? "ort"
                    : "postnummer"
              );
        return c.json(
          {
            error: uiErrorFill(locale, "homeDeliveryFieldsRequired", {
              fields: fieldLabels.join(", "),
            }),
            fields: Object.fromEntries(
              fieldKeys.map((f) => [f, uiError(locale, "fieldRequired")])
            ),
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
        return c.json({ error: uiError(locale, "invalidQty") }, 400);
      }
    }

    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.shopSlug, sellerSlug))
      .limit(1);

    if (!seller) {
      return c.json({ error: uiError(locale, "sellerNotFound") }, 404);
    }

    // P2.12 (audit 2026-05-26): tidigare accepterades order även om
    // säljaren satts till INACTIVE (avslutad/avstängd). Spegla den
    // public seller-profilen som redan döljer shoppen.
    if (seller.status !== "ACTIVE") {
      return c.json(
        { error: uiError(locale, "sellerNotAccepting") },
        410
      );
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);

    if (!team) {
      return c.json({ error: uiError(locale, "teamNotFound") }, 404);
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    if (!campaign || campaign.status !== "ACTIVE") {
      return c.json({ error: uiError(locale, "campaignInactive") }, 400);
    }

    // Backstop för godkännandet. Aktiveringen är spärrad på vägen in, men
    // en kampanj kan ha blivit aktiv före den spärren fanns, eller genom en
    // framtida kodväg. Det är här riktiga pengar byter händer, så det är
    // här spärren måste hålla även om allt annat missats.
    if (!(await isOrgApprovedForPublicSales(team.orgId))) {
      log.warn(
        { orgId: team.orgId, campaignId: campaign.id },
        "checkout blockerad: föreningen är inte godkänd för publik försäljning"
      );
      return c.json(
        { error: uiError(locale, "shopNotAccepting") },
        403
      );
    }

    // Säljperiod: jämför dagens datum (YYYY-MM-DD) mot kampanjens
    // start/slut. `date`-kolumnerna kommer tillbaka som ISO-strängar så
    // lexikografisk jämförelse är korrekt. Vi räknar i Europe/Stockholm
    // så perioden inte glider en dag fel kring midnatt (UTC-offset).
    const todayStr = stockholmDateIso();
    const withinPeriod =
      campaign.startDate <= todayStr && todayStr <= campaign.endDate;
    if (!withinPeriod && !campaign.allowSalesOutsidePeriod) {
      // Föreningen har stängt försäljning mellan perioderna.
      return c.json(
        { error: uiError(locale, "salesPeriodInactive") },
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
          error: uiError(
            locale,
            campaign.deliveryType === "BULK"
              ? "campaignBulkDeliveryOnly"
              : "campaignDirectDeliveryOnly"
          ),
        },
        400
      );
    }

    // Priset kommer från kampanjens katalog, inte från klientens payload,
    // och en produkt utanför katalogen kan inte beställas.
    const productMap = await resolveCampaignCatalog(campaign.id);

    let totalOre = 0;
    const orderLines: Array<{
      type: "physical" | "shipping_fee";
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
        return c.json(
          {
            error:
              uiError(locale, "productNotFoundPrefix") + item.productId,
          },
          400
        );
      }

      const qty = item.qty;
      const unitPrice = product.effectivePriceOre;
      const lineTotal = unitPrice * qty;
      const taxRate = VAT_RATE_BASIS_POINTS;
      const taxAmount = vatOfGrossOre(lineTotal);

      totalOre += lineTotal;
      orderLines.push({
        type: "physical",
        reference: product.sku,
        name: localizedProductName(locale, {
          slug: product.slug,
          sku: product.sku,
          fallback: product.name,
        }),
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
      return c.json({ error: uiError(locale, "emptyCart") }, 400);
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
          type: "shipping_fee",
          reference: "SHIPPING",
          name: shippingLineName(locale),
          quantity: 1,
          unit_price: shippingOre,
          tax_rate: VAT_RATE_BASIS_POINTS,
          total_amount: shippingOre,
          total_tax_amount: vatOfGrossOre(shippingOre),
        });
        totalOre += shippingOre;
      }
    }

    // MASTERPLAN_01 KC4.3: normalisera adress-fält så databasen aldrig
    // får t.ex. "  112 34  " — försämrar både matchning, Fortnox-export
    // och Stripe-validering.
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
            paymentMethod: "STRIPE",
            status: "DRAFT",
            totalOre,
            shippingOre,
            countsTowardStats,
            marginPercentAtSale: campaign.marginPercent,
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
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
    } catch (err) {
      // P2.13: kollision på unique(idempotencyKey) — en parallell
      // request har precis vunnit racet. Returnera den befintliga.
      //
      // Scout fix 2026-05-26 (DB CRIT-001): efter vi scope:ar nyckeln
      // till sellerSlug+body-hash är kollisioner nu nästan alltid
      // legitima retries från samma klient. Vi verifierar ändå att
      // email matchar innan vi returnerar viewToken — defense-in-depth.
      const pgCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";
      const isUniqueViolation =
        pgCode === "23505" ||
        /unique/i.test(err instanceof Error ? err.message : String(err));
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
                  uiError(locale, "idempotencyConflict"),
              },
              409
            );
          }
          const winnerUrl = winner.stripeCheckoutSessionId
            ? await getCheckoutUrl(winner.stripeCheckoutSessionId)
            : null;
          return c.json({
            orderId: winner.id,
            stripeSessionId: winner.stripeCheckoutSessionId,
            checkoutUrl: winnerUrl,
            viewToken: issueOrderViewToken(winner.id),
            idempotent: true,
          });
        }
      }
      throw err;
    }

    let stripeSession;
    try {
      stripeSession = await createCheckoutSession({
        orderId: order.id,
        customerEmail: trimmedEmail.toLowerCase(),
        locale,
        lineItems: orderLines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          unitAmountOre: line.unit_price,
        })),
        successUrl: `${SITE_URL}${localePrefix}/shop/${sellerSlug}/bekraftelse?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${SITE_URL}${localePrefix}/shop/${sellerSlug}/kassa?cancelled=1`,
        metadata: {
          sellerId: seller.id,
          locale,
        },
      });
    } catch (stripeErr) {
      await db
        .update(customerOrders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(customerOrders.id, order.id));

      void auditLog({
        userId: null,
        action: "order.failed",
        entityType: "customer_order",
        entityId: order.id,
        meta: {
          ...requestContext((n) => c.req.header(n)),
          reason: "stripe_session_creation_failed",
          orgId: team.orgId,
          totalOre,
        },
      });

      log.error({ err: stripeErr }, "Stripe session creation failed");
      return c.json({ error: uiError(locale, "paymentInitFailed") }, 502);
    }

    await db
      .update(customerOrders)
      .set({
        stripeCheckoutSessionId: stripeSession.sessionId,
        status: "PENDING",
        updatedAt: new Date(),
      })
      .where(eq(customerOrders.id, order.id));

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
        stripeSessionId: stripeSession.sessionId,
        totalOre,
        itemCount: dbOrderLines.length,
      },
    });

    return c.json({
      orderId: order.id,
      stripeSessionId: stripeSession.sessionId,
      checkoutUrl: stripeSession.checkoutUrl,
      viewToken: issueOrderViewToken(order.id),
    });
  } catch (err) {
    log.error({ err }, "Checkout creation failed");
    return c.json({ error: uiError(locale, "checkoutFailed") }, 500);
  }
});

checkout.post("/webhook/stripe", async (c) => {
  const isProd = process.env.NODE_ENV === "production";
  const hasSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const devAllowUnsigned =
    process.env.ROOTS_ALLOW_UNSIGNED_STRIPE_WEBHOOK === "true";

  if (!hasSecret) {
    if (isProd) {
      log.error(
        "Stripe webhook called in production without STRIPE_WEBHOOK_SECRET — refusing"
      );
      return c.json({ error: "Webhook not configured" }, 503);
    }
    if (!devAllowUnsigned) {
      log.warn(
        "Stripe webhook hit in non-prod without STRIPE_WEBHOOK_SECRET and without ROOTS_ALLOW_UNSIGNED_STRIPE_WEBHOOK=true — refusing"
      );
      return c.json({ error: "Webhook not configured" }, 503);
    }
  }

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("stripe-signature") || "";

  let snapshot: StripeSessionSnapshot | null = null;
  let eventId = "";
  let eventType = "checkout.session.completed";

  if (hasSecret) {
    try {
      const event = constructStripeEvent(rawBody, signatureHeader);
      eventId = event.id;
      eventType = event.type;
      if (!isStripePaidEvent(event.type) && !isStripeFailEvent(event.type)) {
        return c.json({ received: true, ignored: event.type });
      }
      snapshot = snapshotFromWebhookEvent(event);
    } catch (err) {
      log.warn({ err }, "Rejected Stripe webhook: invalid signature or payload");
      return c.json({ error: "Invalid signature" }, 401);
    }
  } else {
    try {
      const parsed = JSON.parse(rawBody) as {
        id?: string;
        type?: string;
        data?: { object?: { id?: string } };
      };
      eventId = typeof parsed.id === "string" ? parsed.id : "";
      eventType =
        typeof parsed.type === "string"
          ? parsed.type
          : "checkout.session.completed";
      const sessionId = parsed.data?.object?.id;
      if (!sessionId) {
        return c.json({ error: "Missing session" }, 400);
      }
      snapshot = await getCheckoutSession(sessionId);
    } catch (err) {
      log.error({ err }, "Unsigned Stripe webhook payload invalid");
      return c.json({ error: "Invalid payload" }, 400);
    }
  }

  if (!snapshot) {
    return c.json({ received: true });
  }

  const dedupKey = eventId || `${snapshot.sessionId}:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
  if (await wasWebhookEventSeen("stripe", dedupKey)) {
    return c.json({ received: true, duplicate: true });
  }

  const dedupConsumed = true;

  try {
    const existingOrder = await findOrderForStripeSession(snapshot);
    if (!existingOrder) {
      return c.json({ received: true });
    }

    if (isStripeFailEvent(eventType) && !snapshot.paid) {
      await markOrderFailedFromStripe({
        order: existingOrder,
        snapshot,
        source: "stripe_webhook",
        reason:
          eventType === "checkout.session.expired"
            ? "stripe_expired"
            : "stripe_payment_failed",
        header: (n) => c.req.header(n),
      });
      return c.json({ received: true });
    }

    if (!snapshot.paid) {
      return c.json({ received: true });
    }

    const result = await markOrderPaidFromStripe({
      order: existingOrder,
      snapshot,
      source: "stripe_webhook",
      header: (n) => c.req.header(n),
    });

    if (result === "mismatch") {
      return c.json({ error: "Amount mismatch" }, 409);
    }

    return c.json({ received: true });
  } catch (err) {
    log.error({ err }, "Webhook processing failed");
    if (dedupConsumed) {
      await clearWebhookEventSeen("stripe", dedupKey);
    }
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

checkout.get("/confirm/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const locale = resolveUiLocale(c);

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);

    if (!order) {
      return c.json({ error: uiError(locale, "orderNotFound") }, 404);
    }

    if (order.stripeCheckoutSessionId && order.status === "PENDING") {
      try {
        const snapshot = await getCheckoutSession(order.stripeCheckoutSessionId);
        if (snapshot.paid) {
          const result = await markOrderPaidFromStripe({
            order,
            snapshot,
            source: "confirm_polling",
            header: (n) => c.req.header(n),
          });
          if (result === "paid") order.status = "PAID";
          if (result === "mismatch") order.status = "FAILED";
        } else if (snapshot.expired) {
          const result = await markOrderFailedFromStripe({
            order,
            snapshot,
            source: "confirm_polling",
            reason: "stripe_expired",
            header: (n) => c.req.header(n),
          });
          if (result === "failed") order.status = "FAILED";
        }
      } catch (stripeErr) {
        log.error({ err: stripeErr }, "Stripe confirmation check failed");
      }
    }

    // MASTERPLAN_01 KC1.7: skicka bekräftelse även när PAID nås via
    // polling-path (webhook kan ha blockats av nätverk/CSRF/IP-listan).
    // Helpern är idempotent — dubbla mail vid race är förebyggda.
    if (order.status === "PAID" || order.status === "CONFIRMED") {
      sendOrderConfirmationIfNeeded(order.id, locale).catch(() => {});
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
    return c.json({ error: uiError(locale, "orderConfirmFailed") }, 500);
  }
});

checkout.get("/order-status/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const locale = resolveUiLocale(c);

  // P1.5 (audit 2026-05-26): endpointen returnerade tidigare full
  // kund-PII till alla som kände till UUID:n. Vi kräver nu en
  // signerad token (`?t=…`) som vi själva utfärdar vid checkout-
  // create + i bekräftelse-mailet. Token är HMAC(orderId|exp) så
  // den binder till en specifik order och kan inte återanvändas.
  const token = c.req.query("t");
  if (!verifyOrderViewToken(orderId, token)) {
    log.warn({ orderId, hasToken: Boolean(token) }, "order-status rejected: invalid token");
    return c.json({ error: uiError(locale, "invalidOrExpiredLink") }, 401);
  }

  try {
    const [order] = await db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.id, orderId))
      .limit(1);

    if (!order) {
      return c.json({ error: uiError(locale, "orderNotFound") }, 404);
    }

    const lines = await db
      .select({
        name: products.name,
        slug: products.slug,
        sku: products.sku,
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
      items: lines.map((l) => ({
        name: localizedProductName(locale, {
          slug: l.slug,
          sku: l.sku,
          fallback: l.name,
        }),
        qty: l.qty,
        unitPriceOre: l.unitPriceOre,
      })),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch order status");
    return c.json({ error: uiError(locale, "orderStatusFailed") }, 500);
  }
});
