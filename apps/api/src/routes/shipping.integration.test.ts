/**
 * INTEGRATIONSTEST — frakt vid hemleverans, från inställning till avräkning.
 *
 * Beslut 16 nov 2026: kunden betalar frakten, beloppen är Roots inställning
 * och föreningen får sina 35 % bara på varorna. Testet går hela vägen genom
 * kassan mot en riktig databas och kontrollerar utfallet i ören.
 *
 * Fraktinställningen är en enda rad för hela systemet. Testet sparar den som
 * fanns och lägger tillbaka den efteråt.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PRICE_A_ORE,
  PRICE_B_ORE,
  createSalesFixture,
  type SalesFixture,
} from "./__fixtures__/sales-fixture";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FEE_ORE = 5500;
const THRESHOLD_ORE = PRICE_A_ORE + PRICE_B_ORE; // 698 kr: Premium + Basic når gränsen

describe.skipIf(!HAS_DB)("frakt vid hemleverans (integration)", () => {
  let fx: SalesFixture;
  let previousSetting: { value: unknown } | undefined;
  let internal: { cookie: string };
  let association: { cookie: string };

  async function setShipping(value: unknown, cookie: string) {
    return fx.json("/v1/admin/settings/shipping", "PUT", value, cookie);
  }

  beforeAll(async () => {
    fx = await createSalesFixture({ label: "frakt", deliveryType: "BOTH" });
    [previousSetting] = await fx.db
      .select({ value: fx.schema.platformSettings.value })
      .from(fx.schema.platformSettings)
      .where(fx.eq(fx.schema.platformSettings.key, "shipping"));
    await fx.db
      .delete(fx.schema.platformSettings)
      .where(fx.eq(fx.schema.platformSettings.key, "shipping"));
    internal = await fx.asUser(fx.ids.internalUser);
    association = await fx.asUser(fx.ids.associationUser);
  });

  afterAll(async () => {
    if (!HAS_DB || !fx) return;
    await fx.db
      .delete(fx.schema.platformSettings)
      .where(fx.eq(fx.schema.platformSettings.key, "shipping"));
    if (previousSetting) {
      await fx.db
        .insert(fx.schema.platformSettings)
        .values({ key: "shipping", value: previousSetting.value });
    }
    await fx.cleanup();
  });

  it("håller hemleverans stängd så länge ingen avgift är satt", async () => {
    const shop = await fx.request(`/v1/shop/by-slug/${fx.shopSlug}`);
    const body = (await shop.json()) as { shipping: Record<string, unknown> };
    expect(body.shipping).toEqual({
      homeDeliveryAvailable: false,
      homeDeliveryFeeOre: null,
      freeShippingThresholdOre: null,
    });

    const direct = await fx.placeOrder({
      items: [{ productId: fx.ids.productA, qty: 1 }],
      deliveryType: "DIRECT",
    });
    expect(direct.status).toBe(400);
    expect(String(direct.body.error)).toMatch(/hemleverans/i);

    // Samlad leverans påverkas inte.
    const bulk = await fx.placeOrder({ items: [{ productId: fx.ids.productA, qty: 1 }] });
    expect(bulk.status).toBe(200);
    const order = await fx.getOrder(bulk.body.orderId as string);
    expect(order.totalOre).toBe(PRICE_A_ORE);
    expect(order.shippingOre).toBe(0);
  });

  it("låter bara intern admin sätta frakten, och bara i hela kronor", async () => {
    const anonymous = await setShipping(
      { homeDeliveryFeeOre: FEE_ORE, freeShippingThresholdOre: null },
      ""
    );
    expect(anonymous.status).toBe(401);

    const club = await setShipping(
      { homeDeliveryFeeOre: 0, freeShippingThresholdOre: null },
      association.cookie
    );
    expect(club.status).toBe(403);

    const oren = await setShipping(
      { homeDeliveryFeeOre: 4950, freeShippingThresholdOre: null },
      internal.cookie
    );
    expect(oren.status).toBe(400);

    const limitWithoutFee = await setShipping(
      { homeDeliveryFeeOre: null, freeShippingThresholdOre: THRESHOLD_ORE },
      internal.cookie
    );
    expect(limitWithoutFee.status).toBe(400);

    // Inget av försöken ovan fick spara något.
    const rows = await fx.db
      .select()
      .from(fx.schema.platformSettings)
      .where(fx.eq(fx.schema.platformSettings.key, "shipping"));
    expect(rows).toHaveLength(0);

    const ok = await setShipping(
      { homeDeliveryFeeOre: FEE_ORE, freeShippingThresholdOre: THRESHOLD_ORE },
      internal.cookie
    );
    expect(ok.status).toBe(200);

    // Audit-loggen skrivs utan att svaret väntar på den.
    await vi.waitFor(async () => {
      const [audit] = await fx.db
        .select()
        .from(fx.schema.auditLogs)
        .where(fx.eq(fx.schema.auditLogs.userId, fx.ids.internalUser));
      expect(audit?.action).toBe("settings.shipping.updated");
      expect(audit?.meta).toMatchObject({
        previous: { homeDeliveryFeeOre: null, freeShippingThresholdOre: null },
        current: {
          homeDeliveryFeeOre: FEE_ORE,
          freeShippingThresholdOre: THRESHOLD_ORE,
        },
      });
    });
  });

  let orderWithShipping = "";
  let orderFreeShipping = "";

  it("lägger frakten på ordern under gränsen och visar den för sig", async () => {
    const created = await fx.placeOrder({
      items: [{ productId: fx.ids.productA, qty: 1 }],
      deliveryType: "DIRECT",
    });
    expect(created.status).toBe(200);
    orderWithShipping = created.body.orderId as string;

    const order = await fx.getOrder(orderWithShipping);
    expect(order.shippingOre).toBe(FEE_ORE);
    expect(order.totalOre).toBe(PRICE_A_ORE + FEE_ORE);
    expect(order.deliveryType).toBe("DIRECT");

    const status = await fx.request(
      `/v1/checkout/order-status/${orderWithShipping}?t=${encodeURIComponent(
        created.body.viewToken as string
      )}`
    );
    const shown = (await status.json()) as { shippingOre: number; totalOre: number };
    expect(shown.shippingOre).toBe(FEE_ORE);
    expect(shown.totalOre).toBe(PRICE_A_ORE + FEE_ORE);

    expect(await fx.pay(orderWithShipping, created.body.viewToken as string)).toBe("PAID");
  });

  it("ger fri frakt när varorna når gränsen (Premium + Basic)", async () => {
    const created = await fx.placeOrder({
      items: [
        { productId: fx.ids.productA, qty: 1 },
        { productId: fx.ids.productB, qty: 1 },
      ],
      deliveryType: "DIRECT",
    });
    expect(created.status).toBe(200);
    orderFreeShipping = created.body.orderId as string;

    const order = await fx.getOrder(orderFreeShipping);
    expect(order.shippingOre).toBe(0);
    expect(order.totalOre).toBe(THRESHOLD_ORE);

    expect(await fx.pay(orderFreeShipping, created.body.viewToken as string)).toBe("PAID");
  });

  it("tar ingen frakt vid samlad leverans även när avgiften är satt", async () => {
    const created = await fx.placeOrder({ items: [{ productId: fx.ids.productB, qty: 1 }] });
    expect(created.status).toBe(200);
    const order = await fx.getOrder(created.body.orderId as string);
    expect(order.shippingOre).toBe(0);
    expect(order.totalOre).toBe(PRICE_B_ORE);
  });

  it("låter inte klienten bestämma frakten", async () => {
    const created = await fx.json("/v1/checkout/create", "POST", {
      sellerSlug: fx.shopSlug,
      customerName: "Fuskkund",
      customerEmail: `e2e-fusk-${fx.run}@roots-test.local`,
      deliveryType: "DIRECT",
      shippingAddressLine1: "Testgatan 1",
      shippingCity: "Kullavik",
      shippingPostalCode: "42934",
      shippingOre: 0,
      totalOre: 100,
      items: [{ productId: fx.ids.productB, qty: 1 }],
      acceptTerms: true,
    });
    expect(created.status).toBe(200);
    const order = await fx.getOrder(created.body.orderId as string);
    expect(order.shippingOre).toBe(FEE_ORE);
    expect(order.totalOre).toBe(PRICE_B_ORE + FEE_ORE);
  });

  it("ger föreningen 35 % på varorna och ingenting på frakten", async () => {
    // Betalt: A med frakt (399 + 55) och A + B utan frakt (698).
    const goodsOre = PRICE_A_ORE + THRESHOLD_ORE;

    // Lagledaren ser förtjänsten räknad på varorna redan under försäljningen.
    const leader = await fx.asUser(fx.ids.leaderUser);
    const dash = await fx.request(`/v1/dashboard/team/${fx.ids.team}`, {
      headers: { cookie: leader.cookie },
    });
    expect(dash.status).toBe(200);
    const stats = ((await dash.json()) as { stats: Record<string, number> }).stats;
    expect(stats.totalSalesOre).toBe(goodsOre);
    expect(stats.teamEarningsOre).toBe(Math.round(goodsOre * 0.35));

    await fx.endCampaign();
    const settled = await fx.json(
      `/v1/settlement/generate/${fx.ids.campaign}`,
      "POST",
      {},
      association.cookie
    );
    expect(settled.status).toBe(200);

    const payout = await fx.getPayout();
    expect(payout.totalSalesOre).toBe(goodsOre);
    expect(payout.teamShareOre).toBe(Math.round(goodsOre * 0.35));
    expect(payout.rootsShareOre).toBe(goodsOre - Math.round(goodsOre * 0.35));
    // Kontroll åt andra hållet: hade frakten räknats med vore andelen större.
    expect(payout.teamShareOre).toBeLessThan(Math.round((goodsOre + FEE_ORE) * 0.35));
  });
});
