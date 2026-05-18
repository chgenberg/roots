/**
 * Sprint E12: tiny CSV-export helpers so /lag/bestallningar and
 * /portal/bestallningar can give the user a one-click "Exportera CSV"
 * button without pulling a CSV dependency.
 *
 * Excel on Swedish locales reads the semicolon dialect natively, so we
 * emit `;`-separated fields. We also prepend a UTF-8 BOM so åäö don't
 * become mojibake when the file is opened in Excel on Windows.
 */

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  // Wrap fields containing the separator, quotes, or newlines in double
  // quotes; embedded quotes get doubled (RFC 4180-ish, Excel-friendly).
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCell).join(";")];
  for (const row of rows) lines.push(row.map(escapeCell).join(";"));
  // Excel sniffs UTF-8 BOM to render åäö correctly.
  return "\uFEFF" + lines.join("\n");
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateForFilename(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface CustomerOrderCsvRow {
  id: string;
  createdAt: string | Date;
  customerName: string;
  customerEmail?: string | null;
  sellerName?: string | null;
  status: string;
  paymentMethod?: string | null;
  deliveryType?: string | null;
  totalOre: number;
}

const CUSTOMER_HEADERS = [
  "Order-ID",
  "Datum",
  "Kund",
  "E-post",
  "Säljare",
  "Status",
  "Betalsätt",
  "Leverans",
  "Belopp (kr)",
];

export function downloadCustomerOrdersCsv(
  filenamePrefix: string,
  rows: CustomerOrderCsvRow[]
) {
  const body = rows.map((o) => [
    o.id,
    new Date(o.createdAt).toLocaleDateString("sv-SE"),
    o.customerName,
    o.customerEmail ?? "",
    o.sellerName ?? "",
    o.status,
    o.paymentMethod ?? "",
    o.deliveryType ?? "",
    String(Math.round(o.totalOre / 100)),
  ]);
  const csv = buildCsv(CUSTOMER_HEADERS, body);
  triggerDownload(
    `${filenamePrefix}-${formatDateForFilename(new Date())}.csv`,
    csv
  );
}

export interface PortalOrderCsvRow {
  id: string;
  createdAt: string | Date;
  orgName?: string | null;
  status: string;
  invoiceStatus?: string | null;
  fortnoxInvoiceId?: string | null;
  totalOre: number;
}

const PORTAL_HEADERS = [
  "Order-ID",
  "Datum",
  "Klubb",
  "Status",
  "Faktura",
  "Fortnox-ID",
  "Belopp (kr)",
];

export function downloadPortalOrdersCsv(
  filenamePrefix: string,
  rows: PortalOrderCsvRow[]
) {
  const body = rows.map((o) => [
    o.id,
    new Date(o.createdAt).toLocaleDateString("sv-SE"),
    o.orgName ?? "",
    o.status,
    o.invoiceStatus ?? "",
    o.fortnoxInvoiceId ?? "",
    String(Math.round(o.totalOre / 100)),
  ]);
  const csv = buildCsv(PORTAL_HEADERS, body);
  triggerDownload(
    `${filenamePrefix}-${formatDateForFilename(new Date())}.csv`,
    csv
  );
}
