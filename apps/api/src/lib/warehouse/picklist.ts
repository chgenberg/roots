import ExcelJS from "exceljs";
import type { BulkRecipient, WarehouseOrder } from "./shipment";
import { toShipmentOrder } from "./shipment";

/**
 * Plocklistan som skickas till lagret: en rad per orderrad, med mottagare
 * och adress på varje rad så att listan går att sortera och filtrera fritt.
 */

const COLUMNS = [
  "Sändning",
  "Order",
  "Betald",
  "Leverans",
  "Mottagare",
  "Adress",
  "Adress 2",
  "Postnummer",
  "Ort",
  "Telefon",
  "E-post",
  "Artikelnummer",
  "Produkt",
  "Antal",
  "Förening",
  "Lag",
  "Kampanj",
  "Säljare",
  "Kund",
  "Meddelande från kund",
  "Anmärkning",
] as const;

export interface Picklist {
  batchNumber: number;
  rows: Array<Record<(typeof COLUMNS)[number], string | number>>;
  /** Summa per artikel, för den som plockar. */
  totals: Array<{ sku: string; productName: string; qty: number }>;
}

/** Datum i svensk tid. Tidsstämplarna i databasen är UTC. */
function stockholmDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function buildPicklist(
  batchNumber: number,
  orders: WarehouseOrder[],
  bulkRecipients: Map<string, BulkRecipient>
): Picklist {
  const rows: Picklist["rows"] = [];
  const totals = new Map<string, { sku: string; productName: string; qty: number }>();

  // Hemleveranser först (ett paket per order), sedan samlade leveranser
  // grupperade per förening och lag, så att lagret kan packa dem ihop.
  const sorted = [...orders].sort((a, b) => {
    if (a.deliveryType !== b.deliveryType) return a.deliveryType === "DIRECT" ? -1 : 1;
    return (
      a.orgName.localeCompare(b.orgName, "sv") ||
      a.teamName.localeCompare(b.teamName, "sv") ||
      a.id.localeCompare(b.id)
    );
  });

  for (const order of sorted) {
    const ship = toShipmentOrder(order, bulkRecipients.get(order.teamId));
    // Listan byggs från ordern som den ser ut nu, så en order som
    // återbetalats efter att sändningen skapades syns här.
    const remark = [
      order.status === "REFUNDED" || order.status === "CANCELLED"
        ? "Återbetald eller avbokad. Skicka inte."
        : order.refundedOre > 0
          ? `Delvis återbetald ${(order.refundedOre / 100).toFixed(2).replace(".", ",")} kr. Kontrollera vad som ska skickas.`
          : "",
      !ship.addressLine1 || !ship.postalCode || !ship.city
        ? "Adress saknas. Kontakta föreningen."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    for (const line of order.lines) {
      rows.push({
        Sändning: batchNumber,
        Order: shortOrderId(order.id),
        Betald: stockholmDate(order.paidAt ?? order.createdAt),
        Leverans: order.deliveryType === "DIRECT" ? "Hemleverans" : "Samlad till föreningen",
        Mottagare: ship.recipientName,
        Adress: ship.addressLine1 ?? "",
        "Adress 2": ship.addressLine2 ?? "",
        Postnummer: ship.postalCode ?? "",
        Ort: ship.city ?? "",
        Telefon: ship.phone ?? "",
        "E-post": ship.email ?? "",
        Artikelnummer: line.sku ?? "",
        Produkt: line.productName,
        Antal: line.qty,
        Förening: order.orgName,
        Lag: order.teamName,
        Kampanj: order.campaign.name,
        Säljare: order.sellerName,
        Kund: order.customer.name,
        "Meddelande från kund": order.note ?? "",
        Anmärkning: remark,
      });
      const key = line.sku ?? line.productName;
      const total = totals.get(key) ?? { sku: line.sku ?? "", productName: line.productName, qty: 0 };
      total.qty += line.qty;
      totals.set(key, total);
    }
  }

  return {
    batchNumber,
    rows,
    totals: [...totals.values()].sort((a, b) => a.sku.localeCompare(b.sku, "sv")),
  };
}

/**
 * Text som börjar med =, +, - eller @ tolkas av Excel som en formel. Kundens
 * namn och meddelande kommer utifrån, så de får aldrig bli körbara i den som
 * öppnar listan. Rena siffror med plus eller minus först (telefonnummer som
 * +46701234567) kan inte anropa något och lämnas som de är.
 */
function safeCell(value: string | number): string | number {
  if (typeof value === "number") return value;
  if (/^[+-][\d\s()-]*$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export async function picklistToXlsx(picklist: Picklist): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Plocklista");
  sheet.columns = COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.min(40, Math.max(12, header.length + 4)),
  }));
  for (const row of picklist.rows) {
    sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c, safeCell(row[c])])));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const summary = workbook.addWorksheet("Summa per artikel");
  summary.columns = [
    { header: "Artikelnummer", key: "sku", width: 22 },
    { header: "Produkt", key: "productName", width: 40 },
    { header: "Antal", key: "qty", width: 10 },
  ];
  for (const total of picklist.totals) {
    summary.addRow({
      sku: safeCell(total.sku),
      productName: safeCell(total.productName),
      qty: total.qty,
    });
  }
  summary.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Byte order mark: får Excel att läsa filen som UTF-8, så att å, ä och ö blir rätt. */
const CSV_BOM = String.fromCharCode(0xfeff);

/** Semikolonseparerad med BOM, så att svensk Excel öppnar den rätt direkt. */
export function picklistToCsv(picklist: Picklist): string {
  const escape = (value: string | number) => {
    const text = String(safeCell(value));
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    COLUMNS.join(";"),
    ...picklist.rows.map((row) => COLUMNS.map((c) => escape(row[c])).join(";")),
  ];
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
