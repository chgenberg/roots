/**
 * INTEGRATIONSTEST — återbetalning från portalen och vad den gör med
 * föreningens pengar.
 *
 * Beslut 16 nov 2026: ingen automatisk återbetalning. Intern admin betalar
 * tillbaka hela eller en del av en order via Stripe. Föreningen får bara
 * 35 % på det som är betalt och inte återbetalt: en väntande utbetalning
 * räknas om direkt, en fakturerad eller betald rörs aldrig utan flaggas.
 *
 * Stripe är stubbat. Inga riktiga betalningar rörs.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createSalesFixture, type SalesFixture } from "./__fixtures__/sales-fixture";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const share = (goodsOre: number) => Math.round(goodsOre * 0.35);

describe.skipIf(!HAS_DB)("återbetalning och avräkning (integration)", () => {
  let fx: SalesFixture;
  let internal: { cookie: string };
  let association: { cookie: string };
  let leader: { cookie: string };
  let stripe: typeof import("../lib/payments/stripe");

  const requestId = () => `test-${randomUUID()}`;

  /**
   * Klienten skickar alltid med vad som enligt sidan redan är återbetalt.
   * Här fylls det i från ordern, som om sidan nyss laddats, om testet inte
   * anger något annat.
   */
  async function refund(orderId: string, body: Record<string, unknown>, cookie = internal.cookie) {
    const expectedRefundedOre =
      "expectedRefundedOre" in body
        ? body.expectedRefundedOre
        : ((await fx.getOrder(orderId))?.refundedOre ?? 0);
    return fx.json(
      `/v1/admin/orders/${orderId}/refund`,
      "POST",
      { ...body, expectedRefundedOre },
      cookie
    );
  }
  const sync = (orderId: string, cookie = internal.cookie) =>
    fx.json(`/v1/admin/orders/${orderId}/refunds/sync`, "POST", {}, cookie);

  async function refundRows(orderId: string) {
    return fx.db
      .select()
      .from(fx.schema.customerOrderRefunds)
      .where(fx.eq(fx.schema.customerOrderRefunds.orderId, orderId));
  }

  async function auditActions(orderId: string) {
    const rows = await fx.db
      .select()
      .from(fx.schema.auditLogs)
      .where(fx.eq(fx.schema.auditLogs.entityId, orderId));
    return rows;
  }

  beforeAll(async () => {
    fx = await createSalesFixture({ label: "refund" });
    stripe = await import("../lib/payments/stripe");
    internal = await fx.asUser(fx.ids.internalUser);
    association = await fx.asUser(fx.ids.associationUser);
    leader = await fx.asUser(fx.ids.leaderUser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!HAS_DB || !fx) return;
    await fx.cleanup();
  });

  // Ordrarna i den här filen. Varuvärdet väljs så att 35 % inte blir jämnt.
  const A = 39_900; // helt återbetald före avräkning
  const B = 69_800; // delvis återbetald före avräkning (100 kr)
  const C = 29_900; // 299 kr varor + 55 kr frakt, allt återbetalt efter avräkning
  const C_SHIPPING = 5500;
  const D = 39_900; // bara frakten återbetald
  const D_SHIPPING = 5500;
  const E = 49_900; // återbetald efter att utbetalningen är gjord
  const F = 19_900; // rörs aldrig
  const G = 39_900; // 399 kr varor + 55 kr frakt, återbetalas i delar efter utbetalningen
  const G_SHIPPING = 5500;
  const H = 29_900; // återbetalas direkt i Stripe, utanför portalen
  const ids = { a: "", b: "", c: "", d: "", e: "", f: "", g: "", h: "" };

  it("släpper bara in intern admin", async () => {
    ids.a = await fx.seedPaidCardOrder({ goodsOre: A });
    const body = { requestId: requestId(), reason: "Kunden ångrade sig", full: true };

    expect((await refund(ids.a, body, "")).status).toBe(401);
    expect((await refund(ids.a, body, leader.cookie)).status).toBe(403);
    expect((await refund(ids.a, body, association.cookie)).status).toBe(403);
    const seller = await fx.asUser(fx.ids.sellerUser);
    expect((await refund(ids.a, body, seller.cookie)).status).toBe(403);
    expect((await sync(ids.a, "")).status).toBe(401);
    expect((await sync(ids.a, association.cookie)).status).toBe(403);

    const order = await fx.getOrder(ids.a);
    expect(order.status).toBe("PAID");
    expect(order.refundedOre).toBe(0);
    expect(await refundRows(ids.a)).toHaveLength(0);
  });

  it("låter inte lag eller förening markera en kortorder som återbetald eller avbokad", async () => {
    for (const cookie of [leader.cookie, association.cookie]) {
      for (const status of ["REFUNDED", "CANCELLED"]) {
        const res = await fx.json(
          `/v1/dashboard/orders/${ids.a}/cancel`,
          "POST",
          { status, reason: "Kunden ångrade sig" },
          cookie
        );
        expect(res.status).toBe(400);
        expect(String(res.body.error)).toMatch(/Roots/);
      }
    }
    expect((await fx.getOrder(ids.a)).status).toBe("PAID");

    // Dialogen visar varken avboka för lagledaren eller återbetala för
    // någon annan än intern admin.
    const asLeader = await fx.request(`/v1/dashboard/seller/orders/${ids.a}`, {
      headers: { cookie: leader.cookie },
    });
    const leaderView = ((await asLeader.json()) as { order: Record<string, unknown> }).order;
    expect(leaderView.canCancel).toBe(false);
    expect(leaderView.canRefund).toBe(false);

    const asInternal = await fx.request(`/v1/dashboard/seller/orders/${ids.a}`, {
      headers: { cookie: internal.cookie },
    });
    const internalView = ((await asInternal.json()) as { order: Record<string, unknown> }).order;
    expect(internalView.canRefund).toBe(true);
  });

  it("kräver skäl, nyckel och ett belopp som ryms på ordern", async () => {
    expect((await refund(ids.a, { requestId: requestId(), full: true })).status).toBe(400);
    expect((await refund(ids.a, { reason: "Kunden ångrade sig", full: true })).status).toBe(400);
    expect(
      (await refund(ids.a, { requestId: requestId(), reason: "Kunden ångrade sig" })).status
    ).toBe(400);
    expect(
      (
        await refund(ids.a, {
          requestId: requestId(),
          reason: "Kunden ångrade sig",
          goodsOre: A + 100,
          shippingOre: 0,
        })
      ).status
    ).toBe(400);
    // Ordern har ingen frakt att betala tillbaka.
    expect(
      (
        await refund(ids.a, {
          requestId: requestId(),
          reason: "Kunden ångrade sig",
          goodsOre: 0,
          shippingOre: 100,
        })
      ).status
    ).toBe(400);
    // Sidan måste säga vad den tror är återbetalt, och det måste stämma.
    expect(
      (
        await refund(ids.a, {
          requestId: requestId(),
          reason: "Kunden ångrade sig",
          full: true,
          expectedRefundedOre: undefined,
        })
      ).status
    ).toBe(400);
    const stale = await refund(ids.a, {
      requestId: requestId(),
      reason: "Kunden ångrade sig",
      full: true,
      expectedRefundedOre: 10_000,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.restart).toBe(true);
    expect((await fx.getOrder(ids.a)).refundedOre).toBe(0);
    expect(await refundRows(ids.a)).toHaveLength(0);
  });

  it("låter ingen stänga en kortorder medan kunden kan stå på betalsidan", async () => {
    const created = await fx.placeOrder({ items: [{ productId: fx.ids.productA, qty: 1 }] });
    const pendingId = created.body.orderId as string;
    expect((await fx.getOrder(pendingId)).status).toBe("PENDING");

    for (const cookie of [leader.cookie, association.cookie, internal.cookie]) {
      const res = await fx.json(
        `/v1/dashboard/orders/${pendingId}/cancel`,
        "POST",
        { status: "CANCELLED", reason: "Kunden hörde av sig" },
        cookie
      );
      expect(res.status).toBe(400);
    }
    expect((await fx.getOrder(pendingId)).status).toBe("PENDING");

    // Betalningen går sedan igenom som vanligt.
    expect(await fx.pay(pendingId, created.body.viewToken as string)).toBe("PAID");

    // En obetald order vars betalsida säkert har löpt ut går att städa bort.
    const old = await fx.placeOrder({ items: [{ productId: fx.ids.productA, qty: 1 }] });
    const oldId = old.body.orderId as string;
    await fx.db
      .update(fx.schema.customerOrders)
      .set({ createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) })
      .where(fx.eq(fx.schema.customerOrders.id, oldId));
    const cancelled = await fx.json(
      `/v1/dashboard/orders/${oldId}/cancel`,
      "POST",
      { status: "CANCELLED", reason: "Aldrig betald" },
      leader.cookie
    );
    expect(cancelled.status).toBe(200);
    expect((await fx.getOrder(oldId)).status).toBe("CANCELLED");

    // Den betalda ordern tas bort ur underlaget igen, så att summorna
    // längre ner bara gäller ordrarna A till H.
    const cleanup = await refund(pendingId, {
      requestId: requestId(),
      reason: "Testorder",
      full: true,
    });
    expect(cleanup.status).toBe(200);
  });

  it("låter lag och förening markera leverans först när Roots skickat ordern", async () => {
    for (const cookie of [leader.cookie, association.cookie]) {
      const res = await fx.json(
        `/v1/dashboard/orders/${ids.a}/fulfillment`,
        "PATCH",
        { status: "DELIVERED" },
        cookie
      );
      expect(res.status).toBe(400);
      expect(String(res.body.error)).toMatch(/lager/i);
    }
    expect((await fx.getOrder(ids.a)).status).toBe("PAID");

    const view = await fx.request(`/v1/dashboard/seller/orders/${ids.a}`, {
      headers: { cookie: leader.cookie },
    });
    const order = ((await view.json()) as { order: Record<string, unknown> }).order;
    expect(order.awaitingWarehouse).toBe(true);
    expect(order.canManageFulfillment).toBe(false);

    // Föreningens gruppknapp rör inte heller ordrar som väntar i lagerkön.
    const bulk = await fx.json(
      `/v1/dashboard/campaign/${fx.ids.campaign}/ship-bulk`,
      "POST",
      {},
      association.cookie
    );
    expect(bulk.status).toBe(200);
    expect(bulk.body.shipped).toBe(0);
    expect((await fx.getOrder(ids.a)).status).toBe("PAID");
  });

  it("återbetalar hela ordern via Stripe, stänger den och loggar det", async () => {
    const spy = vi.spyOn(stripe, "refundCheckoutSession");
    const key = requestId();
    const res = await refund(ids.a, { requestId: key, reason: "Kunden ångrade sig", full: true });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({
      amountOre: A,
      idempotencyKey: `roots-refund-${key}`,
    });

    const order = await fx.getOrder(ids.a);
    expect(order.status).toBe("REFUNDED");
    expect(order.refundedOre).toBe(A);
    expect(order.refundedAt).toBeTruthy();
    expect(order.cancelledByUserId).toBe(fx.ids.internalUser);
    // Skälet är en intern anteckning. På ordern, som lag och förening kan
    // läsa, står bara att den är återbetald.
    expect(order.cancelReason).toBe("Återbetald till kunden av Roots");
    const leaderView = await fx.request(`/v1/dashboard/seller/orders/${ids.a}`, {
      headers: { cookie: leader.cookie },
    });
    expect(JSON.stringify(await leaderView.json())).not.toContain("Kunden ångrade sig");

    const rows = await refundRows(ids.a);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "SUCCEEDED", amountOre: A, shippingOre: 0 });
    expect(rows[0]!.stripeRefundId).toBeTruthy();

    // Audit-loggen skrivs utan att svaret väntar på den.
    await vi.waitFor(async () => {
      const audit = (await auditActions(ids.a)).find((r) => r.action === "order.refunded");
      expect(audit).toBeTruthy();
      expect(audit!.userId).toBe(fx.ids.internalUser);
      expect(audit!.meta).toMatchObject({
        amountOre: A,
        shippingOre: 0,
        reason: "Kunden ångrade sig",
        previousStatus: "PAID",
        status: "REFUNDED",
      });
    });

    // Dubbelklick med samma nyckel: samma svar, ingen andra återbetalning.
    const replay = await refund(ids.a, { requestId: key, reason: "Kunden ångrade sig", full: true });
    expect(replay.status).toBe(200);
    expect(replay.body.alreadyDone).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);

    // Ett nytt försök på en helt återbetald order stoppas.
    const again = await refund(ids.a, { requestId: requestId(), reason: "En gång till", full: true });
    expect(again.status).toBe(409);
    expect((await fx.getOrder(ids.a)).refundedOre).toBe(A);
  });

  it("låter en delåterbetald order stå kvar som betald, med mindre varuvärde", async () => {
    ids.b = await fx.seedPaidCardOrder({ goodsOre: B, status: "DELIVERED" });
    const res = await refund(ids.b, {
      requestId: requestId(),
      reason: "En flaska var trasig",
      goodsOre: 10_000,
      shippingOre: 0,
    });
    expect(res.status).toBe(200);

    const order = await fx.getOrder(ids.b);
    expect(order.status).toBe("DELIVERED");
    expect(order.refundedOre).toBe(10_000);
    expect(order.cancelledAt).toBeNull();

    await vi.waitFor(async () => {
      const audit = (await auditActions(ids.b)).find(
        (r) => r.action === "order.partially_refunded"
      );
      expect(audit?.meta).toMatchObject({ amountOre: 10_000, goodsOre: 10_000 });
    });

    // Resten går fortfarande att återbetala, men inte mer än resten.
    const tooMuch = await refund(ids.b, {
      requestId: requestId(),
      reason: "För mycket",
      goodsOre: B - 10_000 + 100,
      shippingOre: 0,
    });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.remainingGoodsOre).toBe(B - 10_000);
  });

  it("rör inte ordern när Stripe säger nej", async () => {
    ids.f = await fx.seedPaidCardOrder({ goodsOre: F });
    vi.spyOn(stripe, "refundCheckoutSession").mockRejectedValueOnce(
      new stripe.StripeRefundError("Charge has already been refunded.", true, false)
    );
    const res = await refund(ids.f, { requestId: requestId(), reason: "Kunden ångrade sig", full: true });
    expect(res.status).toBe(502);
    expect(res.body.stripeError).toBe("Charge has already been refunded.");

    const order = await fx.getOrder(ids.f);
    expect(order.status).toBe("PAID");
    expect(order.refundedOre).toBe(0);
    const rows = await refundRows(ids.f);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("FAILED");
  });

  it("slutför samma återbetalning efter ett avbrott, utan att betala två gånger", async () => {
    ids.d = await fx.seedPaidCardOrder({ goodsOre: D, shippingOre: D_SHIPPING });
    const key = requestId();
    const body = {
      requestId: key,
      reason: "Paketet kom för sent, frakten tillbaka",
      goodsOre: 0,
      shippingOre: D_SHIPPING,
    };

    // Nätverksfel: vi vet inte om Stripe tog emot anropet.
    const spy = vi
      .spyOn(stripe, "refundCheckoutSession")
      .mockRejectedValueOnce(new Error("socket hang up"));
    const broken = await refund(ids.d, body);
    expect(broken.status).toBe(502);
    expect((await fx.getOrder(ids.d)).refundedOre).toBe(0);
    expect((await refundRows(ids.d))[0]!.status).toBe("PENDING");

    // Ett nytt försök med annan nyckel släpps inte förbi det oavslutade:
    // det är så färskt att det fortfarande kan vara på väg hos Stripe.
    const other = await refund(ids.d, { requestId: requestId(), reason: "Nytt försök", full: true });
    expect(other.status).toBe(409);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await refundRows(ids.d)).toHaveLength(1);

    // Samma nyckel igen slutför, med samma idempotensnyckel mot Stripe.
    const retried = await refund(ids.d, body);
    expect(retried.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1]![0].idempotencyKey).toBe(spy.mock.calls[0]![0].idempotencyKey);

    const order = await fx.getOrder(ids.d);
    expect(order.status).toBe("PAID");
    expect(order.refundedOre).toBe(D_SHIPPING);
    expect(order.refundedShippingOre).toBe(D_SHIPPING);
    const rows = await refundRows(ids.d);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("SUCCEEDED");
  });

  it("bokför ett avbrutet försök som Stripe faktiskt genomförde, utan att betala igen", async () => {
    ids.h = await fx.seedPaidCardOrder({ goodsOre: H });
    const create = vi
      .spyOn(stripe, "refundCheckoutSession")
      .mockRejectedValueOnce(new Error("socket hang up"));
    const broken = await refund(ids.h, {
      requestId: requestId(),
      reason: "Skadad vara",
      goodsOre: 5000,
      shippingOre: 0,
    });
    expect(broken.status).toBe(502);
    const [row] = await refundRows(ids.h);
    expect(row!.status).toBe("PENDING");

    // Stripe hade tagit emot återbetalningen; bara svaret kom bort.
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      {
        refundId: "re_test_recovered_1",
        amountOre: 5000,
        status: "succeeded",
        refundRowId: row!.id,
        createdAt: new Date(),
      },
    ]);
    const next = await refund(ids.h, {
      requestId: requestId(),
      reason: "Nytt försök",
      goodsOre: 5000,
      shippingOre: 0,
    });
    expect(next.status).toBe(409);
    expect(next.body.recovered).toBe(true);
    expect(next.body.recoveredAmountOre).toBe(5000);
    // Ingen andra återbetalning skickades.
    expect(create).toHaveBeenCalledTimes(1);

    const order = await fx.getOrder(ids.h);
    expect(order.refundedOre).toBe(5000);
    const rows = await refundRows(ids.h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "SUCCEEDED", stripeRefundId: "re_test_recovered_1" });
  });

  it("stänger ett avbrutet försök som aldrig nådde Stripe och släpper fram nästa", async () => {
    const create = vi
      .spyOn(stripe, "refundCheckoutSession")
      .mockRejectedValueOnce(new Error("socket hang up"));
    const broken = await refund(ids.h, {
      requestId: requestId(),
      reason: "Skadad vara, del två",
      goodsOre: 2000,
      shippingOre: 0,
    });
    expect(broken.status).toBe(502);
    const pending = (await refundRows(ids.h)).find((r) => r.status === "PENDING")!;

    // Senaste anropet är äldre än vad som kan vara på väg, och Stripe har det inte.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await fx.db
      .update(fx.schema.customerOrderRefunds)
      .set({ createdAt: tenMinutesAgo, lastAttemptAt: tenMinutesAgo })
      .where(fx.eq(fx.schema.customerOrderRefunds.id, pending.id));
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      {
        refundId: "re_test_recovered_1",
        amountOre: 5000,
        status: "succeeded",
        refundRowId: "en-annan-rad",
        createdAt: new Date(),
      },
    ]);

    const next = await refund(ids.h, {
      requestId: requestId(),
      reason: "Skadad vara, del två",
      goodsOre: 2000,
      shippingOre: 0,
    });
    expect(next.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);

    const rows = await refundRows(ids.h);
    expect(rows.find((r) => r.id === pending.id)!.status).toBe("FAILED");
    expect(rows.filter((r) => r.status === "SUCCEEDED")).toHaveLength(2);
    expect((await fx.getOrder(ids.h)).refundedOre).toBe(7000);
  });

  it("bokför en återbetalning som gjorts direkt i Stripe", async () => {
    const before = await fx.getOrder(ids.h);
    const ownRows = (await refundRows(ids.h)).filter((r) => r.status === "SUCCEEDED");
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      ...ownRows.map((r) => ({
        refundId: r.stripeRefundId!,
        amountOre: r.amountOre,
        status: "succeeded",
        refundRowId: r.id,
        createdAt: r.createdAt,
      })),
      {
        refundId: "re_test_dashboard_1",
        amountOre: 3000,
        status: "succeeded",
        refundRowId: null,
        createdAt: new Date(),
      },
    ]);
    const create = vi.spyOn(stripe, "refundCheckoutSession");

    const res = await sync(ids.h);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ recorded: 1, recordedOre: 3000, recovered: 0 });
    expect(res.body.missingAtStripe).toEqual([]);
    // Synken skapar aldrig en återbetalning.
    expect(create).not.toHaveBeenCalled();

    const order = await fx.getOrder(ids.h);
    expect(order.refundedOre).toBe(before.refundedOre + 3000);
    expect(order.status).toBe("PAID");
    const external = (await refundRows(ids.h)).find(
      (r) => r.stripeRefundId === "re_test_dashboard_1"
    );
    expect(external).toMatchObject({ status: "SUCCEEDED", amountOre: 3000, shippingOre: 0 });

    // En gång till ändrar ingenting.
    const again = await sync(ids.h);
    expect(again.body).toMatchObject({ recorded: 0, recovered: 0 });
    expect((await fx.getOrder(ids.h)).refundedOre).toBe(before.refundedOre + 3000);
  });

  const atStripe = (refundId: string, amountOre: number, refundRowId: string | null) => ({
    refundId,
    amountOre,
    status: "succeeded",
    refundRowId,
    createdAt: new Date(),
  });

  it("stänger inte ett försök på ett läsfel när ett tidigare anrop kan ha gått fram", async () => {
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000 });
    const body = { requestId: requestId(), reason: "Skadad vara", goodsOre: 10_000, shippingOre: 0 };
    const create = vi
      .spyOn(stripe, "refundCheckoutSession")
      // Första anropet: tidsgräns. Stripe betalade tillbaka, men svaret kom aldrig.
      .mockRejectedValueOnce(new Error("timeout"))
      // Omtaget: betalningen gick inte att läsa. Det säger inget om det första anropet.
      .mockRejectedValueOnce(
        new stripe.StripeRefundError("Could not read the payment at Stripe: 429", false, true)
      );

    expect((await refund(id, body)).status).toBe(502);
    const retry = await refund(id, body);
    expect(retry.status).toBe(502);
    expect(retry.body.restart).toBeUndefined();
    const [row] = await refundRows(id);
    expect(row).toMatchObject({ status: "PENDING", attempts: 2 });
    expect((await fx.getOrder(id)).refundedOre).toBe(0);

    // Nästa försök frågar Stripe, hittar återbetalningen och bokför den i
    // stället för att betala tillbaka en gång till.
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      atStripe("re_test_first_call", 10_000, row!.id),
    ]);
    const next = await refund(id, {
      requestId: requestId(),
      reason: "Nytt försök",
      goodsOre: 10_000,
      shippingOre: 0,
    });
    expect(next.status).toBe(409);
    expect(next.body.recovered).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect((await fx.getOrder(id)).refundedOre).toBe(10_000);
    expect((await refundRows(id))[0]).toMatchObject({
      status: "SUCCEEDED",
      stripeRefundId: "re_test_first_call",
    });

    // Resten återbetalas, så att ordern inte ligger kvar i summorna nedan.
    const rest = await refund(id, { requestId: requestId(), reason: "Resten", full: true });
    expect(rest.status).toBe(200);
    expect((await fx.getOrder(id)).status).toBe("REFUNDED");
  });

  it("stänger försöket när det allra första anropet föll innan något skickades", async () => {
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000 });
    vi.spyOn(stripe, "refundCheckoutSession").mockRejectedValueOnce(
      new stripe.StripeRefundError("Could not read the payment at Stripe: timeout", false, true)
    );
    const res = await refund(id, { requestId: requestId(), reason: "Skadad vara", full: true });
    expect(res.status).toBe(502);
    expect(res.body.restart).toBe(true);
    expect((await refundRows(id))[0]).toMatchObject({ status: "FAILED", attempts: 1 });
    expect((await fx.getOrder(id)).refundedOre).toBe(0);

    const ok = await refund(id, { requestId: requestId(), reason: "Skadad vara", full: true });
    expect(ok.status).toBe(200);
  });

  it("låter försöket stå öppet när Stripe avvisade själva återbetalningsanropet utan att pröva det", async () => {
    // Stripes klient kan göra ett eget omförsök på ett anrop som redan gått
    // fram. "För många anrop" på det säger inget om det första.
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000 });
    const key = requestId();
    vi.spyOn(stripe, "refundCheckoutSession").mockRejectedValueOnce(
      new stripe.StripeRefundError("Too many requests", false, false)
    );
    const res = await refund(id, { requestId: key, reason: "Skadad vara", full: true });
    expect(res.status).toBe(502);
    expect(res.body.restart).toBeUndefined();
    expect((await refundRows(id))[0]).toMatchObject({ status: "PENDING", attempts: 1 });

    // Samma nyckel igen slutför.
    const ok = await refund(id, { requestId: key, reason: "Skadad vara", full: true });
    expect(ok.status).toBe(200);
    expect(await refundRows(id)).toHaveLength(1);
    expect((await fx.getOrder(id)).status).toBe("REFUNDED");
  });

  it("bokför inget nytt från Stripe när en bokförd återbetalning saknas där", async () => {
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000 });
    const first = await refund(id, {
      requestId: requestId(),
      reason: "Skadad vara",
      goodsOre: 10_000,
      shippingOre: 0,
    });
    expect(first.status).toBe(200);

    // Vår återbetalning har misslyckats hos Stripe i efterhand, och någon
    // har ersatt kunden med 100 kr direkt i Stripes panel.
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      atStripe("re_test_compensation", 10_000, null),
    ]);
    const res = await sync(id);
    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(0);
    expect(res.body.missingAtStripe).toHaveLength(1);
    // Ingenting räknas dubbelt: ordern står kvar på 100 kr återbetalt.
    expect((await fx.getOrder(id)).refundedOre).toBe(10_000);
    expect(await refundRows(id)).toHaveLength(1);
    vi.restoreAllMocks();

    const rest = await refund(id, { requestId: requestId(), reason: "Resten", full: true });
    expect(rest.status).toBe(200);
  });

  it("skapar ingen ny återbetalning när Stripe har en som inte är bokförd här", async () => {
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000 });
    // Ett försök som stängts som misslyckat, fast Stripe hade återbetalningen.
    const [closed] = await fx.db
      .insert(fx.schema.customerOrderRefunds)
      .values({
        orderId: id,
        requestId: requestId(),
        amountOre: 5000,
        shippingOre: 0,
        reason: "Skadad vara",
        status: "FAILED",
        failureMessage: "Avbrutet försök.",
        createdByUserId: fx.ids.internalUser,
        attempts: 2,
      })
      .returning();
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      atStripe("re_test_closed_wrongly", 5000, closed!.id),
    ]);
    const create = vi.spyOn(stripe, "refundCheckoutSession");

    // Stripe har 50 kr återbetalt, vi har 0. Då skapas inget nytt.
    const blocked = await refund(id, {
      requestId: requestId(),
      reason: "Skadad vara",
      goodsOre: 5000,
      shippingOre: 0,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.needsSync).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect((await fx.getOrder(id)).refundedOre).toBe(0);

    // Synken bokför den på raden som stängts fel.
    const synced = await sync(id);
    expect(synced.status).toBe(200);
    expect(synced.body).toMatchObject({ recovered: 1, recorded: 0, recordedOre: 5000 });
    expect((await fx.getOrder(id)).refundedOre).toBe(5000);
    const rows = await refundRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "SUCCEEDED",
      stripeRefundId: "re_test_closed_wrongly",
      failureMessage: null,
    });

    // Nu stämmer böckerna och resten går att återbetala.
    const rest = await refund(id, { requestId: requestId(), reason: "Resten", full: true });
    expect(rest.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await fx.getOrder(id)).status).toBe("REFUNDED");
  });

  it("räknar en återbetalning utifrån på varorna först och resten som frakt", async () => {
    const id = await fx.seedPaidCardOrder({ goodsOre: 30_000, shippingOre: 4900 });
    // 320 kr återbetalt i Stripes panel: mer än varorna (300), mindre än hela ordern.
    vi.spyOn(stripe, "listRefundsForSession").mockResolvedValue([
      atStripe("re_test_dashboard_big", 32_000, null),
    ]);
    const res = await sync(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ recorded: 1, recordedOre: 32_000 });

    const order = await fx.getOrder(id);
    expect(order.status).toBe("PAID");
    expect(order.refundedOre).toBe(32_000);
    expect(order.refundedShippingOre).toBe(2000);
    expect((await refundRows(id))[0]).toMatchObject({
      status: "SUCCEEDED",
      amountOre: 32_000,
      shippingOre: 2000,
    });

    // Kvar är bara 29 kr frakt, och det går att återbetala.
    const rest = await refund(id, { requestId: requestId(), reason: "Resten", full: true });
    expect(rest.status).toBe(200);
    const closed = await fx.getOrder(id);
    expect(closed.status).toBe("REFUNDED");
    expect(closed.refundedOre).toBe(34_900);
    expect(closed.refundedShippingOre).toBe(4900);
  });

  it("räknar av bara det som är betalt och inte återbetalt", async () => {
    ids.c = await fx.seedPaidCardOrder({ goodsOre: C, shippingOre: C_SHIPPING });
    ids.e = await fx.seedPaidCardOrder({ goodsOre: E });
    ids.g = await fx.seedPaidCardOrder({ goodsOre: G, shippingOre: G_SHIPPING });

    await fx.endCampaign();
    const settled = await fx.json(
      `/v1/settlement/generate/${fx.ids.campaign}`,
      "POST",
      {},
      association.cookie
    );
    expect(settled.status).toBe(200);

    // A är helt återbetald och faller bort. B har 100 kr varor återbetalda.
    // D har bara fått frakten tillbaka, så varuvärdet står kvar.
    // H har fått tillbaka 50 + 20 kr härifrån och 30 kr direkt i Stripe.
    const goods = [B - 10_000, C, D, E, F, G, H - 10_000];
    const payout = await fx.getPayout();
    expect(payout.status).toBe("PENDING");
    expect(payout.totalSalesOre).toBe(goods.reduce((s, g) => s + g, 0));
    expect(payout.teamShareOre).toBe(goods.reduce((s, g) => s + share(g), 0));
    expect(payout.teamShareOre + payout.rootsShareOre).toBe(payout.totalSalesOre);
  });

  it("minskar en väntande utbetalning automatiskt när en order återbetalas", async () => {
    const before = await fx.getPayout();

    // Hela order C tillbaka: 299 kr varor och 55 kr frakt.
    const res = await refund(ids.c, {
      requestId: requestId(),
      reason: "Ångerrätt, varorna tillbaka",
      full: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.payout).toMatchObject({ kind: "recalculated" });

    const order = await fx.getOrder(ids.c);
    expect(order.status).toBe("REFUNDED");
    expect(order.refundedOre).toBe(C + C_SHIPPING);
    expect(order.refundedShippingOre).toBe(C_SHIPPING);

    const after = await fx.getPayout();
    expect(after.status).toBe("PENDING");
    // Föreningens andel minskar med 35 % av varorna. Frakten var aldrig med.
    expect(after.totalSalesOre).toBe(before.totalSalesOre - C);
    expect(after.teamShareOre).toBe(before.teamShareOre - share(C));
    expect(after.teamShareOre + after.rootsShareOre).toBe(after.totalSalesOre);
    expect(after.reviewRequiredAt).toBeNull();

    await vi.waitFor(async () => {
      const [audit] = await fx.db
        .select()
        .from(fx.schema.auditLogs)
        .where(fx.eq(fx.schema.auditLogs.entityId, after.id));
      expect(audit?.action).toBe("payout.recalculated");
    });
  });

  it("vägrar markera utbetald om beloppet ändrats sedan sidan laddades", async () => {
    const payout = await fx.getPayout();
    const stale = await fx.json(
      `/v1/payouts/${payout.id}/status`,
      "PATCH",
      {
        status: "PAID",
        paymentReference: "BG-TEST-1",
        expectedTeamShareOre: payout.teamShareOre + share(C),
      },
      internal.cookie
    );
    expect(stale.status).toBe(409);
    expect((await fx.getPayout()).status).toBe("PENDING");

    const ok = await fx.json(
      `/v1/payouts/${payout.id}/status`,
      "PATCH",
      {
        status: "PAID",
        paymentReference: "BG-TEST-1",
        expectedTeamShareOre: payout.teamShareOre,
      },
      internal.cookie
    );
    expect(ok.status).toBe(200);
    expect((await fx.getPayout()).status).toBe("PAID");
  });

  it("rör aldrig en betald utbetalning, utan flaggar den för manuell hantering", async () => {
    const paid = await fx.getPayout();
    expect(paid.status).toBe("PAID");

    const res = await refund(ids.e, {
      requestId: requestId(),
      reason: "Ångerrätt efter utbetalning",
      full: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.payout).toMatchObject({
      kind: "flagged",
      payoutStatus: "PAID",
      paidTeamShareOre: paid.teamShareOre,
      correctTeamShareOre: paid.teamShareOre - share(E),
      overpaidOre: share(E),
    });
    // Kunden har fått sina pengar oavsett.
    expect((await fx.getOrder(ids.e)).status).toBe("REFUNDED");

    const after = await fx.getPayout();
    expect(after.status).toBe("PAID");
    expect(after.totalSalesOre).toBe(paid.totalSalesOre);
    expect(after.teamShareOre).toBe(paid.teamShareOre);
    expect(after.rootsShareOre).toBe(paid.rootsShareOre);
    expect(after.paidAt?.getTime()).toBe(paid.paidAt?.getTime());
    expect(after.paymentReference).toBe("BG-TEST-1");
    expect(after.reviewRequiredAt).toBeTruthy();
    expect(after.reviewResolvedAt).toBeNull();

    // Utbetalningslistan visar mellanskillnaden.
    const list = await fx.request("/v1/payouts", { headers: { cookie: internal.cookie } });
    const row = ((await list.json()) as { payouts: Array<Record<string, unknown>> }).payouts.find(
      (p) => p.id === paid.id
    );
    expect(row?.review).toEqual({
      needsReview: true,
      correctTeamShareOre: paid.teamShareOre - share(E),
      correctTotalSalesOre: paid.totalSalesOre - E,
      overpaidOre: share(E),
      outstandingOre: share(E),
      settledOre: 0,
    });
  });

  it("låter intern admin kvittera flaggan utan att beloppen ändras", async () => {
    const paid = await fx.getPayout();
    const path = `/v1/payouts/${paid.id}/review/resolve`;

    expect((await fx.json(path, "POST", { note: "Dras nästa gång" }, association.cookie)).status).toBe(403);
    expect((await fx.json(path, "POST", { note: "" }, internal.cookie)).status).toBe(400);

    const ok = await fx.json(
      path,
      "POST",
      { note: "Dras av på nästa utbetalning, avstämt med kassören" },
      internal.cookie
    );
    expect(ok.status).toBe(200);

    const after = await fx.getPayout();
    expect(after.reviewResolvedAt).toBeTruthy();
    expect(after.reviewResolvedByUserId).toBe(fx.ids.internalUser);
    expect(after.reviewResolvedTeamShareOre).toBe(paid.teamShareOre - share(E));
    expect(after.reviewNote).toMatch(/nästa utbetalning/);
    expect(after.status).toBe("PAID");
    expect(after.teamShareOre).toBe(paid.teamShareOre);
    expect(after.totalSalesOre).toBe(paid.totalSalesOre);

    // En andra tryckning skriver inte över anteckningen.
    const again = await fx.json(path, "POST", { note: "Skriv över" }, internal.cookie);
    expect(again.status).toBe(409);
    expect((await fx.getPayout()).reviewNote).toMatch(/nästa utbetalning/);
  });

  it("flaggar inte om när bara frakt återbetalas, och behåller kvitteringen", async () => {
    const before = await fx.getPayout();
    const res = await refund(ids.g, {
      requestId: requestId(),
      reason: "Paketet kom för sent, frakten tillbaka",
      goodsOre: 0,
      shippingOre: G_SHIPPING,
    });
    expect(res.status).toBe(200);
    // Frakten ingår inte i föreningens andel, så utbetalningen berörs inte.
    expect(res.body.payout).toEqual({ kind: "none" });

    const after = await fx.getPayout();
    expect(after.reviewRequiredAt?.getTime()).toBe(before.reviewRequiredAt?.getTime());
    expect(after.reviewResolvedAt?.getTime()).toBe(before.reviewResolvedAt?.getTime());
    expect(after.reviewNote).toBe(before.reviewNote);
  });

  it("visar vad som är nytt när en andra återbetalning kommer efter kvitteringen", async () => {
    const paid = await fx.getPayout();
    const res = await refund(ids.g, {
      requestId: requestId(),
      reason: "En flaska var trasig",
      goodsOre: 10_000,
      shippingOre: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.payout).toMatchObject({
      kind: "flagged",
      addedOre: share(G) - share(G - 10_000),
      overpaidOre: share(E) + share(G) - share(G - 10_000),
    });

    const flagged = await fx.getPayout();
    expect(flagged.teamShareOre).toBe(paid.teamShareOre);
    expect(flagged.status).toBe("PAID");
    // Den tidigare kvitteringen ligger kvar; flaggan är nyare än den.
    expect(flagged.reviewNote).toMatch(/nästa utbetalning/);
    expect(flagged.reviewRequiredAt!.getTime()).toBeGreaterThan(
      flagged.reviewResolvedAt!.getTime()
    );

    const list = await fx.request("/v1/payouts", { headers: { cookie: internal.cookie } });
    const row = ((await list.json()) as { payouts: Array<{ id: string; review: Record<string, number | boolean> }> }).payouts.find(
      (p) => p.id === paid.id
    )!;
    const added = share(G) - share(G - 10_000);
    expect(row.review).toMatchObject({
      needsReview: true,
      overpaidOre: share(E) + added,
      settledOre: share(E),
      outstandingOre: added,
    });

    // Kvitteringen gäller det belopp som stod på skärmen.
    const path = `/v1/payouts/${paid.id}/review/resolve`;
    const stale = await fx.json(
      path,
      "POST",
      { note: "Reglerat", expectedCorrectTeamShareOre: (row.review.correctTeamShareOre as number) + 1 },
      internal.cookie
    );
    expect(stale.status).toBe(409);
    const ok = await fx.json(
      path,
      "POST",
      { note: "Även den andra reglerad", expectedCorrectTeamShareOre: row.review.correctTeamShareOre },
      internal.cookie
    );
    expect(ok.status).toBe(200);
  });
});
