import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { judgePayment } from "./judge";
import { buildPicklist, picklistToCsv, picklistToXlsx, shortOrderId } from "./picklist";
import type { WarehouseOrder } from "./shipment";
import type { StripePaymentState } from "../payments/stripe";

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PAID",
  paymentMethod: "STRIPE" as const,
  stripeCheckoutSessionId: "cs_test_1",
  totalOre: 45_400,
  refundedOre: 0,
};

const paid = (over: Partial<StripePaymentState> = {}): StripePaymentState => ({
  sessionId: "cs_test_1",
  paid: true,
  amountTotalOre: 45_400,
  currency: "SEK",
  amountRefundedOre: 0,
  paymentIntentId: "pi_1",
  ...over,
});

describe("avstämning mot Stripe", () => {
  it("godkänner en order som är betald med rätt belopp i kronor", () => {
    expect(judgePayment(order, paid())).toEqual({ status: "OK", note: null });
  });

  it("stoppar en order som Stripe inte visar som betald", () => {
    expect(judgePayment(order, paid({ paid: false })).status).toBe("NOT_PAID");
  });

  it("stoppar fel belopp och säger båda beloppen", () => {
    const verdict = judgePayment(order, paid({ amountTotalOre: 39_900 }));
    expect(verdict.status).toBe("AMOUNT_MISMATCH");
    expect(verdict.note).toContain("399,00 kr");
    expect(verdict.note).toContain("454,00 kr");
  });

  it("stoppar betalning i annan valuta", () => {
    expect(judgePayment(order, paid({ currency: "EUR" })).status).toBe("CURRENCY_MISMATCH");
  });

  it("stoppar en återbetalning som gjorts hos Stripe men inte hos oss", () => {
    const verdict = judgePayment(order, paid({ amountRefundedOre: 10_000 }));
    expect(verdict.status).toBe("REFUND_MISMATCH");
  });

  it("flaggar en delåterbetald order även när den stämmer med Stripe", () => {
    const verdict = judgePayment(
      { ...order, refundedOre: 10_000 },
      paid({ amountRefundedOre: 10_000 })
    );
    expect(verdict.status).toBe("PARTLY_REFUNDED");
  });

  it("godkänner aldrig en order utan kortbetalning eller som inte längre är betald", () => {
    expect(
      judgePayment({ ...order, paymentMethod: "DIRECT_TO_LEADER", stripeCheckoutSessionId: null }, null)
        .status
    ).toBe("NO_STRIPE_PAYMENT");
    expect(judgePayment({ ...order, stripeCheckoutSessionId: null }, null).status).toBe(
      "NO_STRIPE_PAYMENT"
    );
    expect(judgePayment({ ...order, status: "REFUNDED" }, paid()).status).toBe("NOT_OPEN");
    expect(judgePayment({ ...order, status: "PENDING" }, paid()).status).toBe("NOT_OPEN");
  });
});

function warehouseOrder(over: Partial<WarehouseOrder>): WarehouseOrder {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status: "PAID",
    createdAt: new Date("2026-11-15T09:00:00Z"),
    paidAt: new Date("2026-11-15T23:30:00Z"),
    deliveryType: "DIRECT",
    paymentMethod: "STRIPE",
    hasStripePayment: true,
    totalOre: 45_400,
    shippingOre: 5500,
    refundedOre: 0,
    countsTowardStats: true,
    note: null,
    customer: { name: "Anna Andersson", email: "anna@example.com", phone: "0700000000" },
    shippingAddress: { line1: "Testgatan 1", line2: null, postalCode: "42934", city: "Kullavik" },
    campaign: { id: "c1", name: "Vårförsäljning" },
    orgId: "org-1",
    orgName: "Kullaviks IF",
    teamId: "team-1",
    teamName: "P13",
    sellerName: "Elsa",
    reconcile: { status: "OK", at: new Date(), note: null },
    sentToWarehouseAt: new Date(),
    batch: { id: "b1", number: 7 },
    shippedAt: null,
    lines: [{ sku: "ROOTS-KIT-001", productName: "Roots Premiumpaket", qty: 1, unitPriceOre: 39_900 }],
    ...over,
  };
}

describe("plocklistan", () => {
  const bulk = new Map([
    [
      "team-1",
      {
        contactName: "Kalle Kassör",
        phone: "0711111111",
        email: "kassor@example.com",
        addressLine1: "Klubbvägen 2",
        postalCode: "42935",
        city: "Kullavik",
      },
    ],
  ]);

  const orders = [
    warehouseOrder({
      id: "33333333-3333-4333-8333-333333333333",
      deliveryType: "BULK",
      shippingOre: 0,
      lines: [
        { sku: "ROOTS-KIT-001", productName: "Roots Premiumpaket", qty: 2, unitPriceOre: 39_900 },
        { sku: "ROOTS-KIT-002", productName: "Roots Basicpaket", qty: 1, unitPriceOre: 29_900 },
      ],
    }),
    warehouseOrder({}),
  ];

  it("har en rad per orderrad, med hemleveranser först och rätt mottagare", () => {
    const list = buildPicklist(7, orders, bulk);
    expect(list.rows).toHaveLength(3);

    const home = list.rows[0]!;
    expect(home.Leverans).toBe("Hemleverans");
    expect(home.Mottagare).toBe("Anna Andersson");
    expect(home.Adress).toBe("Testgatan 1");
    expect(home.Order).toBe(shortOrderId("22222222-2222-4222-8222-222222222222"));
    // Betald 23:30 UTC den 15:e är den 16:e i Sverige.
    expect(home.Betald).toBe("2026-11-16");

    const club = list.rows[1]!;
    expect(club.Leverans).toBe("Samlad till föreningen");
    expect(club.Mottagare).toBe("Kullaviks IF, P13, c/o Kalle Kassör");
    expect(club.Adress).toBe("Klubbvägen 2");
    expect(club.Kund).toBe("Anna Andersson");
  });

  it("summerar antal per artikel", () => {
    expect(buildPicklist(7, orders, bulk).totals).toEqual([
      { sku: "ROOTS-KIT-001", productName: "Roots Premiumpaket", qty: 3 },
      { sku: "ROOTS-KIT-002", productName: "Roots Basicpaket", qty: 1 },
    ]);
  });

  it("säger till när en order är delvis återbetald", () => {
    const list = buildPicklist(7, [warehouseOrder({ refundedOre: 10_000 })], bulk);
    expect(list.rows[0]!.Anmärkning).toMatch(/Delvis återbetald 100,00 kr/);
  });

  it("säger till när ordern återbetalats helt efter att sändningen skapades", () => {
    const list = buildPicklist(
      7,
      [warehouseOrder({ status: "REFUNDED", refundedOre: 45_400 })],
      bulk
    );
    expect(list.rows[0]!.Anmärkning).toBe("Återbetald eller avbokad. Skicka inte.");
  });

  it("säger till när en samlad leverans saknar adress", () => {
    const list = buildPicklist(
      7,
      [warehouseOrder({ deliveryType: "BULK", teamId: "team-utan-adress" })],
      bulk
    );
    expect(list.rows[0]!.Mottagare).toBe("Kullaviks IF, P13");
    expect(list.rows[0]!.Anmärkning).toBe("Adress saknas. Kontakta föreningen.");
  });

  it("lämnar telefonnummer med plus orörda", () => {
    const list = buildPicklist(
      7,
      [
        warehouseOrder({
          customer: { name: "Anna Andersson", email: null, phone: "+46 70-123 45 67" },
        }),
      ],
      bulk
    );
    const csv = picklistToCsv(list);
    expect(csv).toContain(";+46 70-123 45 67;");
    expect(csv).not.toContain("'+46");
  });

  it("låter inte kundens text bli en formel i Excel eller bryta CSV-raden", async () => {
    const list = buildPicklist(
      7,
      [
        warehouseOrder({
          customer: { name: "=HYPERLINK(\"http://ont.example\")", email: null, phone: null },
          note: "Ring; på \"porten\"\nandra raden",
        }),
      ],
      bulk
    );

    const csv = picklistToCsv(list);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toContain("Sändning;Order;Betald");
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://ont.example\"\")\"");
    expect(csv).toContain("\"Ring; på \"\"porten\"\"\nandra raden\"");

    const workbook = new ExcelJS.Workbook();
    const xlsx = await picklistToXlsx(list);
    // ExcelJS typar sin egen Buffer; innehållet är samma bytes.
    await workbook.xlsx.load(xlsx as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Plocklista")!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1);
    const mottagare = sheet.getRow(2).getCell(header.indexOf("Mottagare") + 1);
    expect(mottagare.type).not.toBe(ExcelJS.ValueType.Formula);
    expect(String(mottagare.value)).toMatch(/^'=HYPERLINK/);
    expect(workbook.getWorksheet("Summa per artikel")!.getRow(2).getCell(3).value).toBe(1);
  });
});
