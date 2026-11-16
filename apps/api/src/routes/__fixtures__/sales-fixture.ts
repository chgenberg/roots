/**
 * Gemensam uppsättning för integrationstesterna som rör pengar: en godkänd
 * förening med kampanj, lag, säljare, två produkter och ett konto per roll.
 * Allt får unika namn per körning och städas med `cleanup()`.
 *
 * Kräver DATABASE_URL och Redis. Stripe stubbas (ROOTS_STRIPE_STUB), så en
 * order når PAID utan riktiga betalningar.
 */

import { randomUUID } from "node:crypto";

process.env.ROOTS_STRIPE_STUB = "true";

export const PRICE_A_ORE = 39_900;
export const PRICE_B_ORE = 29_900;

export type SalesFixture = Awaited<ReturnType<typeof createSalesFixture>>;

export async function createSalesFixture(opts: {
  label: string;
  deliveryType?: "BULK" | "DIRECT" | "BOTH";
}) {
  const { db } = await import("@roots/db");
  const schema = await import("@roots/db/schema");
  const { app } = await import("../../app");
  const { createSession } = await import("../../lib/session");
  const { eq, inArray } = await import("drizzle-orm");
  // Redis ansluter först vid första kommandot, och det kommandot avvisas.
  // Utan det här hamnar den första sessionen i minnet och hittas sedan inte
  // när Redis väl svarar.
  const { connectRedis } = await import("../../lib/redis");
  await connectRedis().catch(() => {});

  const run = `${opts.label}-${randomUUID().slice(0, 8)}`;
  const shopSlug = `e2e-${run}`;
  // Egen adress per körning, så att kassans spärr per IP inte delas mellan
  // testfiler eller upprepade körningar.
  const clientIp = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: `E2E Förening ${run}`, type: "association", verified: true })
    .returning();

  const users = await db
    .insert(schema.users)
    .values([
      {
        email: `e2e-saljare-${run}@roots-test.local`,
        passwordHash: "not-used-in-this-test",
        role: "SELLER",
        orgId: org.id,
        contactName: "Testsäljare",
      },
      {
        email: `e2e-lagledare-${run}@roots-test.local`,
        passwordHash: "not-used-in-this-test",
        role: "TEAM_LEADER",
        orgId: org.id,
        contactName: "Testlagledare",
      },
      {
        email: `e2e-forening-${run}@roots-test.local`,
        passwordHash: "not-used-in-this-test",
        role: "ASSOCIATION_ADMIN",
        orgId: org.id,
        contactName: "Testadmin",
      },
      {
        // Intern admin kräver MFA; utan den stänger mfa-required de
        // känsliga ytorna.
        email: `e2e-intern-${run}@roots-test.local`,
        passwordHash: "not-used-in-this-test",
        role: "INTERNAL_ADMIN",
        orgId: null,
        contactName: "Testintern",
        mfaEnabledAt: new Date(),
      },
    ])
    .returning();

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      orgId: org.id,
      name: `E2E Kampanj ${run}`,
      slug: `e2e-kampanj-${run}`,
      status: "ACTIVE",
      startDate: iso(new Date(today.getTime() - 7 * 86_400_000)),
      endDate: iso(new Date(today.getTime() + 7 * 86_400_000)),
      deliveryType: opts.deliveryType ?? "BULK",
      marginPercent: 35,
    })
    .returning();

  const [team] = await db
    .insert(schema.teams)
    .values({
      orgId: org.id,
      campaignId: campaign.id,
      leaderId: users[1].id,
      name: `E2E Lag ${run}`,
      inviteToken: `e2e-invite-${run}`.slice(0, 32),
    })
    .returning();

  const [seller] = await db
    .insert(schema.sellers)
    .values({
      userId: users[0].id,
      teamId: team.id,
      campaignId: campaign.id,
      shopSlug,
      displayName: "Testsäljare",
      status: "ACTIVE",
    })
    .returning();

  const products = await db
    .insert(schema.products)
    .values([
      {
        sku: `E2E-A-${run}`,
        name: "E2E Premiumpaket",
        slug: `e2e-premium-${run}`,
        priceOre: PRICE_A_ORE,
        active: true,
      },
      {
        sku: `E2E-B-${run}`,
        name: "E2E Basicpaket",
        slug: `e2e-basic-${run}`,
        priceOre: PRICE_B_ORE,
        active: true,
      },
    ])
    .returning();

  await db.insert(schema.campaignProducts).values([
    { campaignId: campaign.id, productId: products[0].id, active: true, sortOrder: 1 },
    { campaignId: campaign.id, productId: products[1].id, active: true, sortOrder: 2 },
  ]);

  const ids = {
    org: org.id,
    campaign: campaign.id,
    team: team.id,
    seller: seller.id,
    sellerUser: users[0].id,
    leaderUser: users[1].id,
    associationUser: users[2].id,
    internalUser: users[3].id,
    productA: products[0].id,
    productB: products[1].id,
  };

  /** Muterande anrop bär en riktig CSRF-token, precis som webbläsaren. */
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const baseHeaders = {
      "x-forwarded-for": clientIp,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    if (method === "GET" || method === "HEAD") {
      return app.request(path, { ...init, headers: baseHeaders });
    }
    const res = await app.request("/v1/csrf-token");
    const { token } = (await res.json()) as { token: string };
    return app.request(path, {
      ...init,
      headers: { ...baseHeaders, "x-csrf-token": token },
    });
  }

  async function asUser(userId: string) {
    const sessionId = await createSession({
      userId,
      // getSession läser om roll och orgId från databasen.
      role: "SELLER",
      orgId: ids.org,
      createdAt: Date.now(),
    });
    return { cookie: `rootsSessionId=${sessionId}` };
  }

  async function json(
    path: string,
    method: string,
    body: unknown,
    cookie?: string
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await request(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return {
      status: res.status,
      body: (await res.json().catch(() => ({}))) as Record<string, unknown>,
    };
  }

  let orderSeq = 0;

  /** Lägger en order i kassan. Varje anrop får egen kund, så inget dedupas. */
  async function placeOrder(order: {
    items: Array<{ productId: string; qty: number }>;
    deliveryType?: "BULK" | "DIRECT";
  }) {
    orderSeq += 1;
    const direct = order.deliveryType === "DIRECT";
    return json("/v1/checkout/create", "POST", {
      sellerSlug: shopSlug,
      customerName: `Testkund ${orderSeq}`,
      customerEmail: `e2e-kund-${run}-${orderSeq}@roots-test.local`,
      deliveryType: order.deliveryType ?? "BULK",
      ...(direct
        ? {
            shippingAddressLine1: "Testgatan 1",
            shippingCity: "Kullavik",
            shippingPostalCode: "429 34",
          }
        : {}),
      items: order.items,
      acceptTerms: true,
    });
  }

  /** Betalar en order via bekräftelsepollningen (stub-Stripe svarar betald). */
  async function pay(orderId: string, viewToken: string): Promise<string> {
    const res = await request(
      `/v1/checkout/confirm/${orderId}?t=${encodeURIComponent(viewToken)}`
    );
    const body = (await res.json()) as { status?: string };
    return body.status ?? `HTTP ${res.status}`;
  }

  async function placePaidOrder(order: Parameters<typeof placeOrder>[0]) {
    const created = await placeOrder(order);
    if (created.status !== 200) {
      throw new Error(`order kunde inte skapas: ${created.status} ${JSON.stringify(created.body)}`);
    }
    const orderId = created.body.orderId as string;
    const status = await pay(orderId, created.body.viewToken as string);
    if (status !== "PAID") throw new Error(`order blev inte betald: ${status}`);
    return orderId;
  }

  /**
   * En betald kortorder direkt i databasen, som kassan hade skapat den.
   * Används när testet behöver en order med frakt utan att röra den
   * systemgemensamma fraktinställningen (som andra testfiler också använder).
   */
  async function seedPaidCardOrder(order: {
    goodsOre: number;
    shippingOre?: number;
    status?: "PAID" | "SHIPPED" | "DELIVERED";
    paidAt?: Date;
    countsTowardStats?: boolean;
    customerName?: string;
    note?: string;
    qty?: number;
  }) {
    orderSeq += 1;
    const shippingOre = order.shippingOre ?? 0;
    const qty = order.qty ?? 1;
    const [row] = await db
      .insert(schema.customerOrders)
      .values({
        orgId: ids.org,
        campaignId: ids.campaign,
        teamId: ids.team,
        sellerId: ids.seller,
        customerName: order.customerName ?? `Testkund ${orderSeq}`,
        customerEmail: `e2e-kund-${run}-${orderSeq}@roots-test.local`,
        customerPhone: shippingOre > 0 ? "0700000000" : null,
        deliveryType: shippingOre > 0 ? "DIRECT" : "BULK",
        ...(shippingOre > 0
          ? {
              shippingAddressLine1: "Testgatan 1",
              shippingPostalCode: "42934",
              shippingCity: "Kullavik",
            }
          : {}),
        note: order.note ?? null,
        paidAt: order.paidAt ?? new Date(),
        paymentMethod: "STRIPE",
        selectedPaymentMethod: "card",
        stripeCheckoutSessionId: `cs_test_stub_${run}_${orderSeq}`,
        status: order.status ?? "PAID",
        totalOre: order.goodsOre + shippingOre,
        shippingOre,
        countsTowardStats: order.countsTowardStats ?? true,
        marginPercentAtSale: 35,
        termsAcceptedAt: new Date(),
      })
      .returning();
    await db.insert(schema.customerOrderLines).values({
      orderId: row.id,
      productId: ids.productA,
      qty,
      unitPriceOre: Math.round(order.goodsOre / qty),
    });
    return row.id;
  }

  async function getOrder(orderId: string) {
    const [row] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, orderId))
      .limit(1);
    return row;
  }

  async function getPayout() {
    const [row] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.campaignId, ids.campaign))
      .limit(1);
    return row;
  }

  async function endCampaign() {
    await db
      .update(schema.campaigns)
      .set({ status: "ENDED" })
      .where(eq(schema.campaigns.id, ids.campaign));
  }

  async function cleanup() {
    // Ordningen följer främmande nycklar bakvägen.
    const orders = await db
      .select({ id: schema.customerOrders.id })
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.campaignId, ids.campaign));
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      for (const table of fixtureOrderChildTables(schema)) {
        await db.delete(table).where(inArray(table.orderId, orderIds));
      }
      const batches = await db
        .select({ id: schema.customerOrders.warehouseBatchId })
        .from(schema.customerOrders)
        .where(inArray(schema.customerOrders.id, orderIds));
      await db
        .delete(schema.customerOrders)
        .where(inArray(schema.customerOrders.id, orderIds));
      const batchIds = [...new Set(batches.map((b) => b.id).filter((id): id is string => !!id))];
      if (batchIds.length > 0) {
        await db
          .delete(schema.warehouseBatches)
          .where(inArray(schema.warehouseBatches.id, batchIds));
      }
    }
    await db.delete(schema.payouts).where(eq(schema.payouts.campaignId, ids.campaign));
    await db
      .delete(schema.campaignProducts)
      .where(eq(schema.campaignProducts.campaignId, ids.campaign));
    await db.delete(schema.sellers).where(eq(schema.sellers.id, ids.seller));
    await db.delete(schema.teams).where(eq(schema.teams.id, ids.team));
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, ids.campaign));
    await db.delete(schema.users).where(
      inArray(schema.users.id, [
        ids.sellerUser,
        ids.leaderUser,
        ids.associationUser,
        ids.internalUser,
      ])
    );
    await db
      .delete(schema.products)
      .where(inArray(schema.products.id, [ids.productA, ids.productB]));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.org));
  }

  return {
    db,
    schema,
    app,
    eq,
    inArray,
    ids,
    run,
    shopSlug,
    request,
    asUser,
    json,
    placeOrder,
    pay,
    placePaidOrder,
    seedPaidCardOrder,
    getOrder,
    getPayout,
    endCampaign,
    cleanup,
  };
}

/** Tabeller med rader per order som måste bort innan ordern kan tas bort. */
function fixtureOrderChildTables(schema: typeof import("@roots/db/schema")) {
  return [schema.customerOrderLines, schema.customerOrderRefunds];
}
