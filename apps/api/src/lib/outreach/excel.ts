/**
 * Excel in och ut för lead-mejlagenten.
 *
 * Listorna kommer från olika håll (Kents och Niclas egna, den nationella
 * Folkspel-listan) med olika rubriker. Vi gissar vilken kolumn som är vad
 * utifrån rubriken och låter den som importerar rätta gissningen innan
 * något sparas.
 */

import ExcelJS from "exceljs";

export const LEAD_FIELDS = ["orgName", "contactName", "email", "website", "memberCount"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];
export type ColumnMapping = Partial<Record<LeadField, number | null>>;

export interface SheetPreview {
  name: string;
  rowCount: number;
  headers: string[];
  sample: string[][];
  mapping: ColumnMapping;
}

export interface ParsedLead {
  orgName: string;
  contactName: string | null;
  email: string;
  website: string | null;
  memberCount: number | null;
}

export const MAX_IMPORT_ROWS = 20_000;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return "";
}

function norm(header: string): string {
  return header.toLowerCase().replace(/[^a-zåäö]/g, "");
}

const PATTERNS: Array<[LeadField, RegExp]> = [
  ["email", /^(epost|epostadress|email|mail|mejl|mejladress)$/],
  ["website", /^(url|webbplats|hemsida|webb|website|webbadress|webbsida|lank|länk)$/],
  ["memberCount", /^(antalmedlemmar|medlemmar|antalsäljandemedlemmar|säljandemedlemmar|antalmedl|medlemsantal)$/],
  ["contactName", /^(kontaktperson|kontakt|kontaktnamn|förnamn|fornamn)$/],
  ["orgName", /^(förening|forening|föreningsnamn|foreningsnamn|kundnamn|klubb|klubbnamn|organisation|organisationsnamn)$/],
];

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, re] of PATTERNS) {
      if (mapping[field] === undefined && re.test(n)) {
        mapping[field] = i;
        return;
      }
    }
  });
  // "Namn" är föreningen om inget annat är det, annars kontaktpersonen.
  const nameCol = headers.findIndex((h) => norm(h) === "namn");
  if (nameCol >= 0) {
    if (mapping.orgName === undefined) mapping.orgName = nameCol;
    else if (mapping.contactName === undefined) mapping.contactName = nameCol;
  }
  for (const f of LEAD_FIELDS) if (mapping[f] === undefined) mapping[f] = null;
  return mapping;
}

function sheetRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length > MAX_IMPORT_ROWS) return;
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    if (cells.some((v) => v)) rows.push(cells);
  });
  return rows;
}

export async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

export function previewWorkbook(wb: ExcelJS.Workbook): SheetPreview[] {
  return wb.worksheets.map((ws) => {
    const rows = sheetRows(ws);
    const headers = rows[0] ?? [];
    return {
      name: ws.name,
      rowCount: Math.max(0, rows.length - 1),
      headers,
      sample: rows.slice(1, 6),
      mapping: suggestMapping(headers),
    };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseEmail(raw: string): string | null {
  const first = raw.split(/[;,\s]+/).find((p) => p.includes("@"));
  const email = first?.trim().toLowerCase().replace(/^mailto:/, "");
  return email && EMAIL_RE.test(email) && email.length <= 255 ? email : null;
}

export function parseWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "").slice(0, 300);
  } catch {
    return null;
  }
}

function parseMembers(raw: string): number | null {
  const digits = raw.replace(/\s/g, "").match(/\d+/)?.[0];
  const n = digits ? Number(digits) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

export interface ParseResult {
  leads: ParsedLead[];
  skippedNoEmail: number;
  skippedNoName: number;
  duplicatesInFile: number;
}

export function parseLeads(wb: ExcelJS.Workbook, sheetName: string, mapping: ColumnMapping): ParseResult {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error("SHEET_NOT_FOUND");
  const rows = sheetRows(ws).slice(1);
  const col = (row: string[], f: LeadField) => {
    const i = mapping[f];
    return i === null || i === undefined ? "" : (row[i] ?? "");
  };

  const seen = new Set<string>();
  const result: ParseResult = { leads: [], skippedNoEmail: 0, skippedNoName: 0, duplicatesInFile: 0 };
  for (const row of rows) {
    const orgName = col(row, "orgName").slice(0, 200);
    const email = parseEmail(col(row, "email"));
    if (!email) {
      result.skippedNoEmail++;
      continue;
    }
    if (!orgName) {
      result.skippedNoName++;
      continue;
    }
    if (seen.has(email)) {
      result.duplicatesInFile++;
      continue;
    }
    seen.add(email);
    const contact = col(row, "contactName").slice(0, 160);
    result.leads.push({
      orgName,
      contactName: contact || null,
      email,
      website: parseWebsite(col(row, "website")),
      memberCount: parseMembers(col(row, "memberCount")),
    });
  }
  return result;
}

export interface ExportRow {
  orgName: string;
  contactName: string | null;
  email: string;
  website: string | null;
  memberCount: number | null;
  totalKr: number | null;
  associationKr: number | null;
  proposalUrl: string;
  status: string;
  sentAt: Date | null;
  proposalOpenCount: number;
  proposalOpenedAt: Date | null;
  note: string | null;
}

export async function buildExport(senderName: string, rows: ExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Roots";
  const ws = wb.addWorksheet("Leads");
  ws.columns = [
    { header: "Förening", key: "orgName", width: 32 },
    { header: "Kontaktperson", key: "contactName", width: 24 },
    { header: "E-post", key: "email", width: 30 },
    { header: "Webbplats", key: "website", width: 30 },
    { header: "Antal medlemmar", key: "memberCount", width: 16 },
    { header: "Räknad försäljning (kr)", key: "totalKr", width: 22 },
    { header: "Till föreningen (kr)", key: "associationKr", width: 20 },
    { header: "Förslagslänk", key: "proposalUrl", width: 34 },
    { header: "Status", key: "status", width: 16 },
    { header: "Skickat", key: "sentAt", width: 18 },
    { header: "Öppnat förslaget (ggr)", key: "proposalOpenCount", width: 20 },
    { header: "Senast öppnat", key: "proposalOpenedAt", width: 18 },
    { header: "Anteckning", key: "note", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  ws.getColumn("sentAt").numFmt = "yyyy-mm-dd hh:mm";
  ws.getColumn("proposalOpenedAt").numFmt = "yyyy-mm-dd hh:mm";
  wb.title = `Leads – ${senderName}`;
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
