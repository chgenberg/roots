/**
 * One-shot utility: read the two masterdata Excel files in
 * `public/Feedback_14:5/` and emit CSV under `packages/db/data/master/`.
 *
 * The CSV files are the canonical source of truth in CI and are diffable
 * in PRs. Run this script locally whenever the Excel masters change:
 *
 *   pnpm --filter @roots/db tsx scripts/extract-master-csv.ts
 *
 * The CSV layout intentionally matches the columns referenced by
 * `seed-masters.ts`. Header row is included.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");

const PUBLIC_DIR = resolve(REPO_ROOT, "public", "Feedback_14:5");
const OUT_DIR = resolve(HERE, "..", "data", "master");

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

function extract(srcRelative: string, outRelative: string, headers: string[]): void {
  const srcPath = resolve(PUBLIC_DIR, srcRelative);
  const wb = XLSX.read(readFileSync(srcPath), { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });

  const csv = rowsToCsv(json, headers);
  const outPath = resolve(OUT_DIR, outRelative);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csv, "utf8");
  console.log(`[masters] ${srcRelative} → ${outRelative} (${json.length} rows)`);
}

function discoverHeaders(srcRelative: string): string[] {
  const srcPath = resolve(PUBLIC_DIR, srcRelative);
  const wb = XLSX.read(readFileSync(srcPath), { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  if (json.length === 0) return [];
  return Object.keys(json[0]);
}

const riksHeaders = discoverHeaders("roots_master_riksorganisationer.xlsx");
const segmentHeaders = discoverHeaders("roots_segment_master_rekommenderad.xlsx");

console.log("[masters] riksorganisation headers:", riksHeaders);
console.log("[masters] segment headers:", segmentHeaders);

extract(
  "roots_master_riksorganisationer.xlsx",
  "riksorganisationer.csv",
  riksHeaders
);
extract(
  "roots_segment_master_rekommenderad.xlsx",
  "segment_master.csv",
  segmentHeaders
);

console.log("[masters] done");
