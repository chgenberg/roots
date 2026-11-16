/**
 * INTEGRATIONSTEST — från betald order till lagret.
 *
 * Beslut 16 nov 2026: daglig avstämning, och en människa godkänner. Testet
 * går hela flödet för intern admin: kön med betalda ordrar, avstämning mot
 * Stripe, godkännande med plocklista och markering som skickad.
 *
 * Stripe är stubbat. Läget hos Stripe ges av testet per order.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { createSalesFixture, type SalesFixture } from "./__fixtures__/sales-fixture";
import type { StripePaymentState } from "../lib/payments/stripe";

const HAS_DB = Boolean(process.env.DATABASE_URL);

interface ListedOrder {
  id: string;
  status: string;
  countsTowardStats: boolean;
  reconcile: { status: string | null; note: string | null };
  sentToWarehouseAt: string | null;
  batch: { id: string; number: number } | null;
}

describe.skipIf(!HAS_DB)("från betald order till lagret (integration)", () => {
  let fx: SalesFixture;
  let internal: { cookie: string };
  let association: { cookie: string };
  let stripe: typeof import("../lib/payments/stripe");

  const DAY = 86_400_000;
  const stockholmDay = (d: Date) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(d);
  // Mitt på dagen, så att datumet är detsamma i UTC och svensk tid.
  const noon = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * DAY);
    d.setUTCHours(11, 0, 0, 0);
    return d;
  };

  const ids = {
    yesterday: "",
    today: "",
    outsidePeriod: "",
    wrongAmount: "",
    refundedAtStripe: "",
    partlyRefunded: "",
    home: "",
    delivered: "",
    manual: "",
  };
  /** Vad "Stripe" svarar per order. Saknas ordern svarar Stripe att allt stämmer. */
  const stripeStates = new Map<string, Partial<StripePaymentState>>();

  function mockStripe() {
    return vi.spyOn(stripe, "getPaymentState").mockImplementation(async (sessionId) => {
      const [order] = await fx.db
        .select()
        .from(fx.schema.customerOrders)
        .where(fx.eq(fx.schema.customerOrders.stripeCheckoutSessionId, sessionId));
      return {
        sessionId,
        paid: true,
        amountTotalOre: order.totalOre,
        currency: "SEK",
        amountRefundedOre: order.refundedOre,
        paymentIntentId: "pi_test",
        ...(stripeStates.get(order.id) ?? {}),
      };
    });
  }

  async function list(query: string) {
    const res = await fx.request(`/v1/admin/warehouse/orders?${query}`, {
      headers: { cookie: internal.cookie },
    });
    expect(res.status).toBe(200);
    return (await res.json()) as { orders: ListedOrder[]; counts: { queue: number; sent: number } };
  }
  const mine = (query = "") => list(`campaignId=${fx.ids.campaign}${query}`);
  const post = (path: string, body: unknown, cookie = internal.cookie) =>
    fx.json(`/v1/admin/warehouse/${path}`, "POST", body, cookie);

  beforeAll(async () => {
    fx = await createSalesFixture({ label: "lager" });
    stripe = await import("../lib/payments/stripe");
    internal = await fx.asUser(fx.ids.internalUser);
    association = await fx.asUser(fx.ids.associationUser);

    ids.yesterday = await fx.seedPaidCardOrder({ goodsOre: 39_900, paidAt: noon(1), qty: 1 });
    ids.today = await fx.seedPaidCardOrder({ goodsOre: 59_800, paidAt: noon(0), qty: 2 });
    ids.outsidePeriod = await fx.seedPaidCardOrder({
      goodsOre: 39_900,
      paidAt: noon(3),
      countsTowardStats: false,
    });
    ids.wrongAmount = await fx.seedPaidCardOrder({ goodsOre: 39_900, paidAt: noon(0) });
    ids.refundedAtStripe = await fx.seedPaidCardOrder({ goodsOre: 39_900, paidAt: noon(0) });
    ids.partlyRefunded = await fx.seedPaidCardOrder({ goodsOre: 79_800, paidAt: noon(0), qty: 2 });
    ids.home = await fx.seedPaidCardOrder({
      goodsOre: 39_900,
      shippingOre: 5500,
      paidAt: noon(0),
      customerName: "=SUM(1;2) Hemkund",
      note: "Ring på porten",
    });
    ids.delivered = await fx.seedPaidCardOrder({
      goodsOre: 39_900,
      status: "DELIVERED",
      paidAt: noon(5),
    });

    // En äldre manuell order utan kortbetalning.
    const [manual] = await fx.db
      .insert(fx.schema.customerOrders)
      .values({
        orgId: fx.ids.org,
        campaignId: fx.ids.campaign,
        teamId: fx.ids.team,
        sellerId: fx.ids.seller,
        customerName: "Kontantkund",
        customerEmail: "",
        deliveryType: "BULK",
        paymentMethod: "DIRECT_TO_LEADER",
        status: "PAID",
        totalOre: 39_900,
        isManual: true,
        verifiedAt: new Date(),
        paidAt: noon(0),
      })
      .returning();
    ids.manual = manual.id;

    await fx.db
      .update(fx.schema.customerOrders)
      .set({ refundedOre: 10_000, refundedAt: new Date() })
      .where(fx.eq(fx.schema.customerOrders.id, ids.partlyRefunded));

    stripeStates.set(ids.wrongAmount, { amountTotalOre: 29_900 });
    stripeStates.set(ids.refundedAtStripe, { amountRefundedOre: 39_900 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!HAS_DB || !fx) return;
    await fx.cleanup();
  });

  it("tar högst hundra ordrar per anrop och tål en trasig kropp", async () => {
    const many = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`
    );
    expect((await post("reconcile", { orderIds: many })).status).toBe(400);
    expect((await post("batches", { orderIds: many })).status).toBe(400);
    expect((await post("ship", null)).status).toBe(400);
    expect((await post("batches", null)).status).toBe(400);
  });

  it("är stängd för alla utom intern admin", async () => {
    const anonymous = await fx.request("/v1/admin/warehouse/orders");
    expect(anonymous.status).toBe(401);
    const club = await fx.request("/v1/admin/warehouse/orders", {
      headers: { cookie: association.cookie },
    });
    expect(club.status).toBe(403);
    expect((await post("batches", { orderIds: [ids.today] }, association.cookie)).status).toBe(403);
    expect((await post("ship", { orderIds: [ids.today] }, association.cookie)).status).toBe(403);
    expect((await post("reconcile", { orderIds: [ids.today] }, "")).status).toBe(401);
    const picklist = await fx.request(
      "/v1/admin/warehouse/batches/11111111-1111-4111-8111-111111111111/picklist",
      { headers: { cookie: association.cookie } }
    );
    expect(picklist.status).toBe(403);
  });

  it("visar betalda ordrar som inte gått till lagret, säljperiodens först", async () => {
    const { orders } = await mine();
    const listed = orders.map((o) => o.id);
    // Den levererade ordern är redan ute och hör inte hemma i kön.
    expect(listed).not.toContain(ids.delivered);
    expect(listed).toHaveLength(8);
    // Ordern utanför säljperioden är äldst betald men kommer ändå sist.
    expect(listed.at(-1)).toBe(ids.outsidePeriod);
    expect(orders.slice(0, -1).every((o) => o.countsTowardStats)).toBe(true);
    expect(listed[0]).toBe(ids.yesterday);
  });

  it("filtrerar på dagen ordern blev betald (vad kom in igår)", async () => {
    const yesterday = await mine(`&date=${stockholmDay(noon(1))}`);
    expect(yesterday.orders.map((o) => o.id)).toEqual([ids.yesterday]);

    const today = await mine(`&date=${stockholmDay(noon(0))}`);
    expect(today.orders.map((o) => o.id)).toContain(ids.today);
    expect(today.orders.map((o) => o.id)).not.toContain(ids.yesterday);

    for (const bad of ["igår", "2026-02-31"]) {
      const res = await fx.request(`/v1/admin/warehouse/orders?date=${bad}`, {
        headers: { cookie: internal.cookie },
      });
      expect(res.status).toBe(400);
    }
  });

  it("stämmer av mot Stripe och markerar avvikelserna", async () => {
    mockStripe();
    const all = Object.values(ids).filter((id) => id !== ids.delivered);
    const res = await post("reconcile", { orderIds: all });
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ checked: 8, ok: 4, deviations: 4 });

    const byId = new Map((await mine()).orders.map((o) => [o.id, o.reconcile]));
    expect(byId.get(ids.yesterday)?.status).toBe("OK");
    expect(byId.get(ids.today)?.status).toBe("OK");
    expect(byId.get(ids.home)?.status).toBe("OK");
    expect(byId.get(ids.wrongAmount)?.status).toBe("AMOUNT_MISMATCH");
    expect(byId.get(ids.wrongAmount)?.note).toMatch(/299,00 kr.*399,00 kr/);
    expect(byId.get(ids.refundedAtStripe)?.status).toBe("REFUND_MISMATCH");
    expect(byId.get(ids.partlyRefunded)?.status).toBe("PARTLY_REFUNDED");
    expect(byId.get(ids.manual)?.status).toBe("NO_STRIPE_PAYMENT");
  });

  it("gör ett fel hos Stripe till en avvikelse, aldrig till ett godkännande", async () => {
    vi.spyOn(stripe, "getPaymentState").mockRejectedValue(new Error("Stripe is down"));
    const res = await post("reconcile", { orderIds: [ids.outsidePeriod] });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ ok: 0, deviations: 1 });
    expect((await fx.getOrder(ids.outsidePeriod)).reconcileStatus).toBe("STRIPE_ERROR");

    const blocked = await post("batches", { orderIds: [ids.outsidePeriod] });
    expect(blocked.status).toBe(409);
    expect((await fx.getOrder(ids.outsidePeriod)).sentToWarehouseAt).toBeNull();
  });

  it("skickar ingenting till lagret när urvalet innehåller en avvikelse", async () => {
    mockStripe();
    const res = await post("batches", {
      orderIds: [ids.yesterday, ids.today, ids.wrongAmount, ids.manual],
    });
    expect(res.status).toBe(409);
    const problems = res.body.problems as Array<{ orderId: string; status: string }>;
    expect(problems.map((p) => p.orderId).sort()).toEqual([ids.manual, ids.wrongAmount].sort());
    expect(res.body.canAcknowledge).toBe(false);

    for (const id of [ids.yesterday, ids.today, ids.wrongAmount, ids.manual]) {
      const order = await fx.getOrder(id);
      expect(order.sentToWarehouseAt).toBeNull();
      expect(order.warehouseBatchId).toBeNull();
    }
  });

  it("stämmer av på nytt vid godkännandet, även om ordern var godkänd i morse", async () => {
    // Ordern fick OK i avstämningen ovan. Sedan dess har den återbetalats
    // direkt hos Stripe.
    expect((await fx.getOrder(ids.today)).reconcileStatus).toBe("OK");
    stripeStates.set(ids.today, { amountRefundedOre: 59_800 });
    mockStripe();
    const res = await post("batches", { orderIds: [ids.today] });
    expect(res.status).toBe(409);
    expect((res.body.problems as Array<{ status: string }>)[0]!.status).toBe("REFUND_MISMATCH");
    expect((await fx.getOrder(ids.today)).sentToWarehouseAt).toBeNull();
    stripeStates.delete(ids.today);
  });

  let batchId = "";
  let batchNumber = 0;

  it("godkänner urvalet, skapar en sändning och märker ordrarna", async () => {
    mockStripe();
    const res = await post("batches", {
      orderIds: [ids.yesterday, ids.today, ids.home],
      note: "Första sändningen",
    });
    expect(res.status).toBe(200);
    const batch = res.body.batch as { id: string; number: number; orderCount: number };
    expect(batch.orderCount).toBe(3);
    // De två samlade leveranserna saknar adress hos både lagledare och
    // föreningsadmin. Det stoppar inte, men den som godkänner får veta det.
    expect(res.body.missingAddress).toBe(2);
    expect(batch.number).toBeGreaterThan(0);
    batchId = batch.id;
    batchNumber = batch.number;

    for (const id of [ids.yesterday, ids.today, ids.home]) {
      const order = await fx.getOrder(id);
      expect(order.sentToWarehouseAt).toBeTruthy();
      expect(order.warehouseBatchId).toBe(batchId);
      // "Skickad till lager" är ingen leveransstatus: ordern är fortfarande betald.
      expect(order.status).toBe("PAID");
    }

    const queue = (await mine()).orders.map((o) => o.id);
    expect(queue).not.toContain(ids.yesterday);
    expect(queue).toContain(ids.wrongAmount);

    const sent = await mine("&view=sent");
    expect(sent.orders.map((o) => o.id).sort()).toEqual(
      [ids.yesterday, ids.today, ids.home].sort()
    );
    expect(sent.orders[0]!.batch).toEqual({ id: batchId, number: batchNumber });

    await vi.waitFor(async () => {
      const [audit] = await fx.db
        .select()
        .from(fx.schema.auditLogs)
        .where(fx.eq(fx.schema.auditLogs.entityId, batchId));
      expect(audit?.action).toBe("warehouse.batch.created");
      expect(audit?.userId).toBe(fx.ids.internalUser);
    });
  });

  it("skickar inte samma order till lagret två gånger", async () => {
    mockStripe();
    const res = await post("batches", { orderIds: [ids.yesterday] });
    expect(res.status).toBe(409);
    expect((res.body.problems as Array<{ status: string }>)[0]!.status).toBe("ALREADY_SENT");
    expect((await fx.getOrder(ids.yesterday)).warehouseBatchId).toBe(batchId);
  });

  it("kräver ett aktivt val för en delåterbetald order", async () => {
    mockStripe();
    const blocked = await post("batches", { orderIds: [ids.partlyRefunded] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.canAcknowledge).toBe(true);
    expect((await fx.getOrder(ids.partlyRefunded)).sentToWarehouseAt).toBeNull();

    const ok = await post("batches", {
      orderIds: [ids.partlyRefunded],
      acknowledgePartlyRefunded: true,
    });
    expect(ok.status).toBe(200);
    expect((await fx.getOrder(ids.partlyRefunded)).sentToWarehouseAt).toBeTruthy();
  });

  it("ger en plocklista i Excel och CSV med rätt rader och adresser", async () => {
    const xlsx = await fx.request(`/v1/admin/warehouse/batches/${batchId}/picklist`, {
      headers: { cookie: internal.cookie },
    });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml");
    expect(xlsx.headers.get("content-disposition")).toContain(
      `Roots_plocklista_${batchNumber}_`
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await xlsx.arrayBuffer()) as ArrayBuffer);
    const sheet = workbook.getWorksheet("Plocklista")!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1) as string[];
    const rows: Array<Record<string, unknown>> = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      rows.push(
        Object.fromEntries(header.map((h, i) => [h, row.getCell(i + 1).value]))
      );
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r["Sändning"] === batchNumber)).toBe(true);

    const home = rows.find((r) => r["Leverans"] === "Hemleverans")!;
    expect(home["Adress"]).toBe("Testgatan 1");
    expect(home["Postnummer"]).toBe("42934");
    expect(home["Ort"]).toBe("Kullavik");
    expect(home["Meddelande från kund"]).toBe("Ring på porten");
    // Kundens namn började med "=" och får inte bli en formel.
    expect(String(home["Mottagare"])).toBe("'=SUM(1;2) Hemkund");

    const club = rows.filter((r) => r["Leverans"] === "Samlad till föreningen");
    expect(club).toHaveLength(2);
    expect(String(club[0]!["Mottagare"])).toContain("E2E Förening");
    expect(String(club[0]!["Mottagare"])).toContain("E2E Lag");
    expect(club.every((r) => r["Anmärkning"] === "Adress saknas. Kontakta föreningen.")).toBe(true);
    expect(home["Anmärkning"] || "").toBe("");
    expect(club.map((r) => r["Antal"]).sort()).toEqual([1, 2]);

    const totals = workbook.getWorksheet("Summa per artikel")!;
    expect(totals.getRow(2).getCell(3).value).toBe(4);

    const csv = await fx.request(
      `/v1/admin/warehouse/batches/${batchId}/picklist?format=csv`,
      { headers: { cookie: internal.cookie } }
    );
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(4);
    expect(text).toContain("Sändning;Order;Betald;Leverans");

    const missing = await fx.request(
      "/v1/admin/warehouse/batches/11111111-1111-4111-8111-111111111111/picklist",
      { headers: { cookie: internal.cookie } }
    );
    expect(missing.status).toBe(404);
  });

  it("markerar skickade i grupp med samma spärrar som på en enskild order", async () => {
    // En av ordrarna hos lagret återbetalas helt innan den hinner skickas.
    await fx.db
      .update(fx.schema.customerOrders)
      .set({ status: "REFUNDED", refundedOre: 59_800 })
      .where(fx.eq(fx.schema.customerOrders.id, ids.today));

    const res = await post("ship", {
      orderIds: [ids.yesterday, ids.home, ids.today, ids.delivered],
    });
    expect(res.status).toBe(200);
    expect(res.body.shipped).toBe(2);
    const skipped = res.body.skipped as Array<{ orderId: string; reason: string }>;
    expect(skipped).toContainEqual({ orderId: ids.today, reason: "CLOSED" });
    expect(skipped).toContainEqual({ orderId: ids.delivered, reason: "ALREADY_SHIPPED" });

    const shipped = await fx.getOrder(ids.yesterday);
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.shippedAt).toBeTruthy();
    // Den återbetalda ordern återupplivas inte, och den levererade backas inte.
    expect((await fx.getOrder(ids.today)).status).toBe("REFUNDED");
    expect((await fx.getOrder(ids.delivered)).status).toBe("DELIVERED");

    // Skickade ordrar lämnar både kön och "hos lagret".
    const sent = (await mine("&view=sent")).orders.map((o) => o.id);
    expect(sent).not.toContain(ids.yesterday);
    expect(sent).toContain(ids.partlyRefunded);

    // Knappen på en enskild order fungerar som förut.
    const single = await fx.json(
      `/v1/dashboard/orders/${ids.partlyRefunded}/fulfillment`,
      "PATCH",
      { status: "SHIPPED" },
      internal.cookie
    );
    expect(single.status).toBe(200);
    const revive = await fx.json(
      `/v1/dashboard/orders/${ids.today}/fulfillment`,
      "PATCH",
      { status: "PAID" },
      internal.cookie
    );
    expect(revive.status).toBe(400);
  });

  it("hittar en order via sökning bland alla ordrar", async () => {
    const byName = await mine("&view=all&q=Hemkund");
    expect(byName.orders.map((o) => o.id)).toEqual([ids.home]);
    const byId = await mine(`&view=all&q=${ids.delivered.slice(0, 8)}`);
    expect(byId.orders.map((o) => o.id)).toEqual([ids.delivered]);
    // Procenttecken i söktexten ska inte matcha allt.
    const wildcard = await mine("&view=all&q=%25");
    expect(wildcard.orders).toHaveLength(0);
  });
});
