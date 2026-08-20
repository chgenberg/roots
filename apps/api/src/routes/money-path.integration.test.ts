/**
 * INTEGRATIONSTEST — hela pengavägen mot en riktig databas.
 *
 * Varför det här testet finns, och varför det inte liknar de andra:
 *
 * Övriga tester i den här mappen mockar `@roots/db` och verifierar en route
 * i taget. Det fångar formfel men inte det som faktiskt kostar pengar —
 * att kedjan butik → kassa → betalning → verifiering → avräkning håller
 * ihop. Varje steg är korrekt isolerat och ändå kan summan bli fel, för
 * felen sitter i övergångarna: en marginal som räknas om i efterhand, en
 * manuell order som slinker in i en utbetalning utan att någon bekräftat
 * den, ett dubbelklick som blir två ordrar och två fakturor.
 *
 * Testet körs därför mot en verklig Postgres och kontrollerar utfallet i
 * kronor. Saknas DATABASE_URL hoppas det över i stället för att fallera, så
 * `pnpm test` fungerar för en utvecklare utan databas. I CI finns Postgres
 * och Redis som service containers, och då körs det på riktigt.
 *
 * Data städas i efterhand via `afterAll`. Varje körning använder egna
 * unika slugs och e-postadresser, så en avbruten körning inte förgiftar
 * nästa.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL);

// Stub-Stripe: låter oss nå PAID utan riktiga merchant-credentials.
// isStubAllowed() läser env vid anrop, inte vid import, så det räcker att
// sätta den innan första requesten. Guarden i stripe.ts vägrar ändå stubba
// när NODE_ENV=production, vilket är precis vad vi vill.
process.env.ROOTS_STRIPE_STUB = "true";

describe.skipIf(!HAS_DB)("pengavägen (integration)", () => {
  // Modulerna importeras dynamiskt så att en saknad DATABASE_URL inte ens
  // försöker upprätta en anslutning när sviten hoppas över.
  let db: typeof import("@roots/db")["db"];
  let schema: typeof import("@roots/db/schema");
  let app: typeof import("../app")["app"];
  let createSession: typeof import("../lib/session")["createSession"];
  let eq: typeof import("drizzle-orm")["eq"];
  let inArray: typeof import("drizzle-orm")["inArray"];
  let vatOfGrossOre: typeof import("@roots/contracts")["vatOfGrossOre"];

  const run = randomUUID().slice(0, 8);
  const ids = {
    org: "",
    campaign: "",
    team: "",
    seller: "",
    sellerUser: "",
    leaderUser: "",
    adminUser: "",
    productA: "",
    productB: "",
  };
  const shopSlug = `e2e-saljare-${run}`;
  const orderIds: string[] = [];

  // Kampanjmarginal och kampanjpris sätts medvetet till värden som inte är
  // "runda", så en förväxling med produktens ordinarie pris eller en
  // default-marginal syns direkt i siffrorna.
  const CAMPAIGN_MARGIN_PERCENT = 35;
  const LIST_PRICE_ORE = 19_900;
  const CAMPAIGN_PRICE_ORE = 17_500;

  /**
   * Alla anrop går via den här, så att muterande requester bär en riktig
   * CSRF-token precis som webbläsaren gör.
   *
   * Tidigare anropades `app.request` direkt, vilket gjorde sviten beroende av
   * att `NODE_ENV` råkade vara `test` — det är det enda läge där CSRF-kontrollen
   * står av. Kördes testerna med `NODE_ENV=development` svarade varje POST 403,
   * och felet visade sig som en kaskad av `/orders/undefined/...` långt från
   * orsaken. Nu går flödet genom samma kontroll som i drift.
   */
  async function request(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") return app.request(path, init);

    const res = await app.request("/v1/csrf-token");
    const { token } = (await res.json()) as { token: string };
    return app.request(path, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string> | undefined) ?? {}),
        "x-csrf-token": token,
      },
    });
  }

  beforeAll(async () => {
    ({ db } = await import("@roots/db"));
    schema = await import("@roots/db/schema");
    ({ app } = await import("../app"));
    ({ createSession } = await import("../lib/session"));
    ({ eq, inArray } = await import("drizzle-orm"));
    ({ vatOfGrossOre } = await import("@roots/contracts"));

    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: `E2E Förening ${run}`,
        type: "association",
        // Godkänd för publik försäljning. En förening som registrerar sig
        // själv får false och kan inte ta emot betalningar (se
        // lib/org-approval.ts) — spärren testas separat längre ner.
        verified: true,
      })
      .returning();
    ids.org = org.id;

    const users = await db
      .insert(schema.users)
      .values([
        {
          // Inte @demo.se — de adresserna flaggas som demokonton och
          // blockeras av mutation-guarderna.
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
          email: `e2e-admin-${run}@roots-test.local`,
          passwordHash: "not-used-in-this-test",
          role: "ASSOCIATION_ADMIN",
          orgId: org.id,
          contactName: "Testadmin",
        },
      ])
      .returning();
    ids.sellerUser = users[0].id;
    ids.leaderUser = users[1].id;
    ids.adminUser = users[2].id;

    // Perioden omfattar dagens datum så ordrar räknas i statistiken.
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const start = new Date(today.getTime() - 7 * 86_400_000);
    const end = new Date(today.getTime() + 7 * 86_400_000);

    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        orgId: org.id,
        name: `E2E Kampanj ${run}`,
        slug: `e2e-kampanj-${run}`,
        status: "ACTIVE",
        startDate: iso(start),
        endDate: iso(end),
        deliveryType: "BULK",
        marginPercent: CAMPAIGN_MARGIN_PERCENT,
      })
      .returning();
    ids.campaign = campaign.id;

    const [team] = await db
      .insert(schema.teams)
      .values({
        orgId: org.id,
        campaignId: campaign.id,
        leaderId: ids.leaderUser,
        name: `E2E Lag ${run}`,
        inviteToken: `e2e-invite-${run}`,
      })
      .returning();
    ids.team = team.id;

    const [seller] = await db
      .insert(schema.sellers)
      .values({
        userId: ids.sellerUser,
        teamId: team.id,
        campaignId: campaign.id,
        shopSlug,
        displayName: "Testsäljare",
        status: "ACTIVE",
      })
      .returning();
    ids.seller = seller.id;

    const products = await db
      .insert(schema.products)
      .values([
        {
          sku: `E2E-A-${run}`,
          name: "E2E Schampo",
          slug: `e2e-schampo-${run}`,
          priceOre: LIST_PRICE_ORE,
          active: true,
        },
        {
          // Aktiv produkt som INTE ingår i kampanjen. Den ska varken visas
          // i butiken eller kunna beställas.
          sku: `E2E-B-${run}`,
          name: "E2E Balsam",
          slug: `e2e-balsam-${run}`,
          priceOre: LIST_PRICE_ORE,
          active: true,
        },
      ])
      .returning();
    ids.productA = products[0].id;
    ids.productB = products[1].id;

    await db.insert(schema.campaignProducts).values({
      campaignId: campaign.id,
      productId: ids.productA,
      customPriceOre: CAMPAIGN_PRICE_ORE,
      active: true,
      sortOrder: 1,
    });
  });

  afterAll(async () => {
    if (!HAS_DB || !db) return;
    // Ordningen följer främmande nycklar bakvägen.
    if (orderIds.length > 0) {
      await db
        .delete(schema.customerOrderLines)
        .where(inArray(schema.customerOrderLines.orderId, orderIds));
    }
    if (ids.campaign) {
      await db
        .delete(schema.customerOrders)
        .where(eq(schema.customerOrders.campaignId, ids.campaign));
      await db
        .delete(schema.payouts)
        .where(eq(schema.payouts.campaignId, ids.campaign));
      await db
        .delete(schema.campaignProducts)
        .where(eq(schema.campaignProducts.campaignId, ids.campaign));
    }
    if (ids.seller) {
      await db.delete(schema.sellers).where(eq(schema.sellers.id, ids.seller));
    }
    if (ids.team) {
      await db.delete(schema.teams).where(eq(schema.teams.id, ids.team));
    }
    if (ids.campaign) {
      await db
        .delete(schema.campaigns)
        .where(eq(schema.campaigns.id, ids.campaign));
    }
    const userIds = [ids.sellerUser, ids.leaderUser, ids.adminUser].filter(
      Boolean
    );
    if (userIds.length > 0) {
      await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    }
    const productIds = [ids.productA, ids.productB].filter(Boolean);
    if (productIds.length > 0) {
      await db
        .delete(schema.products)
        .where(inArray(schema.products.id, productIds));
    }
    if (ids.org) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, ids.org));
    }
  });

  async function asUser(userId: string) {
    const sessionId = await createSession({
      userId,
      // getSession läser om roll och orgId från databasen, så värdet här
      // spelar mindre roll än vad användarraden säger.
      role: "SELLER",
      orgId: ids.org,
      createdAt: Date.now(),
    });
    return { cookie: `rootsSessionId=${sessionId}` };
  }

  it("visar bara kampanjens produkter, och till kampanjens pris", async () => {
    const res = await request(`/v1/shop/by-slug/${shopSlug}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      products: Array<{ id: string; priceOre: number }>;
    };

    const ids_ = body.products.map((p) => p.id);
    expect(ids_).toContain(ids.productA);
    // Ordinarie pris får inte läcka igenom när kampanjen satt ett eget.
    expect(
      body.products.find((p) => p.id === ids.productA)?.priceOre
    ).toBe(CAMPAIGN_PRICE_ORE);
    // Aktiv men inte kurerad in i kampanjen: ska inte gå att beställa.
    expect(ids_).not.toContain(ids.productB);
  });

  it("vägrar en produkt utanför kampanjkatalogen", async () => {
    const res = await request("/v1/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sellerSlug: shopSlug,
        customerName: "Kund Kundsson",
        customerEmail: `kund-${run}@roots-test.local`,
        acceptTerms: true,
        items: [{ productId: ids.productB, qty: 1 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("vägrar order utan godkända köpvillkor", async () => {
    const res = await request("/v1/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sellerSlug: shopSlug,
        customerName: "Kund Kundsson",
        customerEmail: `kund-${run}@roots-test.local`,
        items: [{ productId: ids.productA, qty: 1 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("stänger kassan för en förening vi inte hunnit godkänna", async () => {
    // Registreringen av en förening är öppen: vem som helst kan skriva
    // "IFK Göteborg" i namnfältet och få ASSOCIATION_ADMIN direkt. Det som
    // måste hålla är steget där supportrar betalar — annars kan någon sälja
    // i en riktig förenings namn och ta emot pengarna själv.
    await db
      .update(schema.organizations)
      .set({ verified: false })
      .where(eq(schema.organizations.id, ids.org));

    const res = await request("/v1/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sellerSlug: shopSlug,
        customerName: "Kund Kundsson",
        customerEmail: `kund-ogodkand-${run}@roots-test.local`,
        acceptTerms: true,
        items: [{ productId: ids.productA, qty: 1 }],
      }),
    });
    expect(res.status).toBe(403);

    // Ingen order får ha skapats — spärren sitter före insert, inte efter.
    const rows = await db
      .select({ id: schema.customerOrders.id })
      .from(schema.customerOrders)
      .where(
        eq(
          schema.customerOrders.customerEmail,
          `kund-ogodkand-${run}@roots-test.local`
        )
      );
    expect(rows).toHaveLength(0);

    await db
      .update(schema.organizations)
      .set({ verified: true })
      .where(eq(schema.organizations.id, ids.org));
  });

  it("skapar order, fryser marginalen och sparar villkorsgodkännandet", async () => {
    const res = await request("/v1/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sellerSlug: shopSlug,
        customerName: "Kund Kundsson",
        customerEmail: `kund-${run}@roots-test.local`,
        acceptTerms: true,
        items: [{ productId: ids.productA, qty: 2 }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orderId: string };
    orderIds.push(body.orderId);

    const [order] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, body.orderId));

    expect(order.totalOre).toBe(CAMPAIGN_PRICE_ORE * 2);
    // Marginalen fryses på ordern. Ändrar föreningen kampanjmarginalen i
    // efterhand får det inte flytta pengar på redan gjord försäljning.
    expect(order.marginPercentAtSale).toBe(CAMPAIGN_MARGIN_PERCENT);
    expect(order.termsAcceptedAt).not.toBeNull();
    expect(order.termsVersion).toBeTruthy();
    expect(order.status).toBe("PENDING");

    // Momsen ska räknas på bruttot med den delade hjälpfunktionen, samma
    // som e-postkvittot och kassan visar.
    expect(vatOfGrossOre(order.totalOre)).toBeGreaterThan(0);
  });

  it("returnerar samma order vid ett dubbelklick i stället för två", async () => {
    const payload = JSON.stringify({
      sellerSlug: shopSlug,
      customerName: "Dubbel Klicksson",
      customerEmail: `dubbel-${run}@roots-test.local`,
      acceptTerms: true,
      items: [{ productId: ids.productA, qty: 1 }],
    });
    const send = () =>
      request("/v1/checkout/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });

    const first = (await (await send()).json()) as { orderId: string };
    const second = (await (await send()).json()) as {
      orderId: string;
      idempotent?: boolean;
    };
    orderIds.push(first.orderId);

    expect(second.orderId).toBe(first.orderId);
    expect(second.idempotent).toBe(true);

    const rows = await db
      .select({ id: schema.customerOrders.id })
      .from(schema.customerOrders)
      .where(
        eq(
          schema.customerOrders.customerEmail,
          `dubbel-${run}@roots-test.local`
        )
      );
    expect(rows).toHaveLength(1);
  });

  it("flyttar ordern till PAID via bekräftelsepollningen", async () => {
    const orderId = orderIds[0];
    const res = await request(`/v1/checkout/confirm/${orderId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("PAID");
  });

  it("håller en obekräftad manuell order utanför avräkningen", async () => {
    const seller = await asUser(ids.sellerUser);
    const manualRes = await request("/v1/dashboard/seller/orders", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: seller.cookie },
      body: JSON.stringify({
        items: [{ productId: ids.productA, qty: 3 }],
        paymentMethod: "swish",
        customerName: "Kontantkund",
      }),
    });
    expect(manualRes.status).toBe(200);
    const manual = (await manualRes.json()) as {
      order: { id: string; status: string };
    };
    orderIds.push(manual.order.id);
    // Säljaren säger att pengarna finns i handen, så statistiken tror på
    // det direkt — men ingen utbetalning får bygga på det ännu.
    expect(manual.order.status).toBe("PAID");

    // Avräkning kräver avslutad kampanj.
    await db
      .update(schema.campaigns)
      .set({ status: "ENDED" })
      .where(eq(schema.campaigns.id, ids.campaign));

    const admin = await asUser(ids.adminUser);
    const settleRes = await request(
      `/v1/settlement/generate/${ids.campaign}`,
      { method: "POST", headers: { cookie: admin.cookie } }
    );
    expect(settleRes.status).toBe(200);
    const settlement = (await settleRes.json()) as {
      settlements: Array<{
        teamId: string;
        totalSalesOre: number;
        teamShareOre: number;
        rootsShareOre: number;
        unverifiedManualOre: number;
        unverifiedManualCount: number;
      }>;
    };

    const row = settlement.settlements.find((s) => s.teamId === ids.team);
    expect(row).toBeDefined();

    // Vid det här laget finns tre ordrar på laget, och bara en enda av dem
    // ska betalas ut:
    //   2 varor  betald online          → räknas
    //   1 vara   dubbelklicket, PENDING → aldrig betald, räknas inte
    //   3 varor  manuell, obekräftad    → väntar på lagledaren
    // Att den obetalda ordern hålls utanför är lika viktigt som resten:
    // en avbruten kassa får aldrig bli en utbetalning.
    const expectedPaidOnlineOre = CAMPAIGN_PRICE_ORE * 2;
    expect(row!.totalSalesOre).toBe(expectedPaidOnlineOre);
    expect(row!.teamShareOre).toBe(
      Math.round((expectedPaidOnlineOre * CAMPAIGN_MARGIN_PERCENT) / 100)
    );
    // Ingen krona får försvinna mellan lagets och Roots andel.
    expect(row!.teamShareOre + row!.rootsShareOre).toBe(row!.totalSalesOre);

    // Den manuella ordern ska synas som väntande, inte tigas bort — annars
    // undrar admin varför summan är lägre än vad laget säger.
    expect(row!.unverifiedManualCount).toBe(1);
    expect(row!.unverifiedManualOre).toBe(CAMPAIGN_PRICE_ORE * 3);
  });

  it("berättar för lagledaren vad som väntar, och att hen får bekräfta det", async () => {
    // Gränssnittet kan inte visa en bekräftelseknapp om API:t inte säger
    // vilka ordrar som väntar och vem som får godkänna dem. Utan det här
    // ligger pengarna kvar utan att någon vet om det.
    const leader = await asUser(ids.leaderUser);
    const res = await request(`/v1/dashboard/team/${ids.team}`, {
      headers: { cookie: leader.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orders: Array<{
        id: string;
        isManual: boolean;
        verifiedAt: string | null;
        canVerify: boolean;
      }>;
      stats: { unverifiedManualOre: number; unverifiedManualCount: number };
    };

    const manual = body.orders.find((o) => o.isManual);
    expect(manual).toBeDefined();
    expect(manual!.verifiedAt).toBeNull();
    expect(manual!.canVerify).toBe(true);

    // Online-ordrar behöver ingen bekräftelse, så knappen ska inte finnas.
    expect(
      body.orders.filter((o) => !o.isManual).every((o) => o.canVerify === false)
    ).toBe(true);

    // Samma summa som avräkningen håller utanför, så vyerna inte visar
    // två olika tal för samma sak.
    expect(body.stats.unverifiedManualCount).toBe(1);
    expect(body.stats.unverifiedManualOre).toBe(CAMPAIGN_PRICE_ORE * 3);
  });

  it("tappar inte pengar när en betald order markeras som levererad", async () => {
    // `status` bär både betalning och leverans i samma kolumn, så när en
    // lagledare markerar en betald order som skickad skrivs PAID över.
    // Tidigare filtrerade avräkningen på `status = 'PAID'` och lagets
    // pengar försvann i samma sekund som de gjorde rätt. Det här testet
    // finns för att felet inte ska kunna komma tillbaka.
    const paidOnlineOrderId = orderIds[0];
    const leader = await asUser(ids.leaderUser);
    const shipRes = await request(
      `/v1/dashboard/orders/${paidOnlineOrderId}/fulfillment`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({ status: "DELIVERED" }),
      }
    );
    expect(shipRes.status).toBe(200);

    const [order] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, paidOnlineOrderId));
    expect(order.status).toBe("DELIVERED");

    await db
      .update(schema.campaigns)
      .set({ status: "ENDED" })
      .where(eq(schema.campaigns.id, ids.campaign));

    const admin = await asUser(ids.adminUser);
    const settleRes = await request(
      `/v1/settlement/generate/${ids.campaign}`,
      { method: "POST", headers: { cookie: admin.cookie } }
    );
    const settlement = (await settleRes.json()) as {
      settlements: Array<{ teamId: string; totalSalesOre: number }>;
    };
    const row = settlement.settlements.find((s) => s.teamId === ids.team);

    // Exakt samma summa som före leveransmarkeringen.
    expect(row!.totalSalesOre).toBe(CAMPAIGN_PRICE_ORE * 2);
  });

  it("räknar in den manuella ordern först efter att lagledaren bekräftat den", async () => {
    const manualOrderId = orderIds[orderIds.length - 1];

    // Säljaren får inte bekräfta sin egen order — hela poängen med steget.
    const seller = await asUser(ids.sellerUser);
    const selfVerify = await request(
      `/v1/dashboard/orders/${manualOrderId}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: seller.cookie },
        body: JSON.stringify({ verified: true }),
      }
    );
    expect(selfVerify.status).toBe(403);

    const leader = await asUser(ids.leaderUser);
    const verify = await request(
      `/v1/dashboard/orders/${manualOrderId}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({ verified: true }),
      }
    );
    expect(verify.status).toBe(200);

    // Första avräkningen satte kampanjen till SETTLED. En omkörning efter
    // en bekräftelse är ett verkligt scenario, så vi öppnar den igen.
    await db
      .update(schema.campaigns)
      .set({ status: "ENDED" })
      .where(eq(schema.campaigns.id, ids.campaign));

    const admin = await asUser(ids.adminUser);
    const settleRes = await request(
      `/v1/settlement/generate/${ids.campaign}`,
      { method: "POST", headers: { cookie: admin.cookie } }
    );
    expect(settleRes.status).toBe(200);
    const settlement = (await settleRes.json()) as {
      settlements: Array<{
        teamId: string;
        totalSalesOre: number;
        teamShareOre: number;
        rootsShareOre: number;
        unverifiedManualCount: number;
      }>;
    };

    const row = settlement.settlements.find((s) => s.teamId === ids.team);
    // 2 betalda online + 3 nyss bekräftade manuella. Dubbelklicket ligger
    // fortfarande kvar som PENDING och ska fortfarande inte räknas.
    const expectedTotal = CAMPAIGN_PRICE_ORE * 5;
    expect(row!.totalSalesOre).toBe(expectedTotal);
    expect(row!.teamShareOre).toBe(
      Math.round((expectedTotal * CAMPAIGN_MARGIN_PERCENT) / 100)
    );
    expect(row!.teamShareOre + row!.rootsShareOre).toBe(expectedTotal);
    expect(row!.unverifiedManualCount).toBe(0);
  });

  it("kräver ett skäl, och låter säljaren rätta sin egen obekräftade order", async () => {
    // CANCELLED och REFUNDED har funnits i statusenumen sedan första
    // migrationen utan att någon kodväg satte dem. En felregistrerad order
    // gick alltså bara att rätta direkt i databasen.
    // Tidigare tester avslutade och avräknade kampanjen. En säljare kan bara
    // registrera i en aktiv kampanj, så den öppnas igen här.
    await db
      .update(schema.campaigns)
      .set({ status: "ACTIVE" })
      .where(eq(schema.campaigns.id, ids.campaign));

    const seller = await asUser(ids.sellerUser);
    const createRes = await request("/v1/dashboard/seller/orders", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: seller.cookie },
      body: JSON.stringify({
        items: [{ productId: ids.productA, qty: 4 }],
        paymentMethod: "cash",
        customerName: "Felregistrerad kund",
      }),
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as { order: { id: string } };
    orderIds.push(created.order.id);

    // Utan skäl går det inte att skilja ett misstag från en ångrad kund i
    // efterhand, så tomt skäl ska nekas.
    const noReason = await request(
      `/v1/dashboard/orders/${created.order.id}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: seller.cookie },
        body: JSON.stringify({ status: "CANCELLED", reason: "  " }),
      }
    );
    expect(noReason.status).toBe(400);

    const ok = await request(
      `/v1/dashboard/orders/${created.order.id}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: seller.cookie },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Skrev in fel antal flaskor",
        }),
      }
    );
    expect(ok.status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, created.order.id));
    expect(row.status).toBe("CANCELLED");
    expect(row.cancelReason).toBe("Skrev in fel antal flaskor");
    expect(row.cancelledByUserId).toBe(ids.sellerUser);

    // En stängd order får inte kunna återupplivas via leveransstatus.
    // "Ångra leveransmarkering" sätter status till PAID, och utan spärr
    // hade den vägen tagit tillbaka pengar som redan lämnat systemet.
    const leader = await asUser(ids.leaderUser);
    const revive = await request(
      `/v1/dashboard/orders/${created.order.id}/fulfillment`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({ status: "PAID" }),
      }
    );
    expect(revive.status).toBe(400);
  });

  it("kräver återbetalning, inte avbokning, för en Stripe-betald order", async () => {
    // Kundens pengar ligger hos Stripe. Att bara markera ordern som avbokad
    // hos oss lämnar dem där utan att någon uppmärksammar det.
    const paidOnlineOrderId = orderIds[0];
    const leader = await asUser(ids.leaderUser);
    const res = await request(
      `/v1/dashboard/orders/${paidOnlineOrderId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Kunden ångrade sig",
        }),
      }
    );
    expect(res.status).toBe(400);

    const [unchanged] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, paidOnlineOrderId));
    expect(unchanged.status).toBe("DELIVERED");
  });

  it("tar en återbetald order ur avräkningen", async () => {
    const paidOnlineOrderId = orderIds[0];
    const leader = await asUser(ids.leaderUser);
    const res = await request(
      `/v1/dashboard/orders/${paidOnlineOrderId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({
          status: "REFUNDED",
          reason: "Kunden ångrade sig inom ångerrätten",
        }),
      }
    );
    expect(res.status).toBe(200);
    const refund = (await res.json()) as { manualStepRequired: string | null };
    // Stripe-återbetalningen kan vi inte utföra själva, och då ska svaret
    // säga det rakt ut i stället för att låta någon tro att den är gjord.
    expect(refund.manualStepRequired).toBeTruthy();

    await db
      .update(schema.campaigns)
      .set({ status: "ENDED" })
      .where(eq(schema.campaigns.id, ids.campaign));

    const admin = await asUser(ids.adminUser);
    const settleRes = await request(
      `/v1/settlement/generate/${ids.campaign}`,
      { method: "POST", headers: { cookie: admin.cookie } }
    );
    expect(settleRes.status).toBe(200);
    const settlement = (await settleRes.json()) as {
      settlements: Array<{
        teamId: string;
        totalSalesOre: number;
        teamShareOre: number;
        rootsShareOre: number;
      }>;
    };
    const row = settlement.settlements.find((s) => s.teamId === ids.team);

    // Kvar står bara den bekräftade manuella ordern på 3 varor. De 2
    // online-varorna är återbetalda och de 4 från förra testet avbokade.
    const expectedTotal = CAMPAIGN_PRICE_ORE * 3;
    expect(row!.totalSalesOre).toBe(expectedTotal);
    expect(row!.teamShareOre).toBe(
      Math.round((expectedTotal * CAMPAIGN_MARGIN_PERCENT) / 100)
    );
    expect(row!.teamShareOre + row!.rootsShareOre).toBe(expectedTotal);
  });

  it("stoppar avbokning när lagets utbetalning redan är genomförd", async () => {
    // Avräkningen skyddar fakturerade och utbetalda payouts mot omräkning.
    // En avbokning efter det skulle göra underlaget och det utbetalda
    // beloppet oense utan att någon fick veta, så den kräver ett aktivt val.
    await db
      .update(schema.payouts)
      .set({ status: "PAID" })
      .where(eq(schema.payouts.teamId, ids.team));

    const verifiedManualOrderId = orderIds[2];
    const leader = await asUser(ids.leaderUser);
    const blocked = await request(
      `/v1/dashboard/orders/${verifiedManualOrderId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Pengarna kom aldrig in",
        }),
      }
    );
    expect(blocked.status).toBe(409);
    const body = (await blocked.json()) as {
      requiresForce?: boolean;
      payoutStatus?: string;
    };
    expect(body.requiresForce).toBe(true);
    expect(body.payoutStatus).toBe("PAID");

    // Ordern ska vara orörd tills någon aktivt väljer att gå vidare.
    const [stillPaid] = await db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.id, verifiedManualOrderId));
    expect(stillPaid.status).toBe("PAID");

    const forced = await request(
      `/v1/dashboard/orders/${verifiedManualOrderId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Pengarna kom aldrig in",
          force: true,
        }),
      }
    );
    expect(forced.status).toBe(200);

    // Ett andra anrop ska inte fela — dubbelklick är inte ett fel.
    const replay = await request(
      `/v1/dashboard/orders/${verifiedManualOrderId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: leader.cookie },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Pengarna kom aldrig in",
        }),
      }
    );
    expect(replay.status).toBe(200);
    const replayBody = (await replay.json()) as { alreadyClosed?: boolean };
    expect(replayBody.alreadyClosed).toBe(true);
  });
});
