/**
 * Export the pre-launch waitlist to Excel + CSV for the launch mailing.
 *
 *   pnpm waitlist:export
 *
 * Signups land in Postgres (`waitlist_signups`) rather than a file on the
 * server on purpose: Railway containers have an ephemeral filesystem, so
 * anything written next to the app disappears on the next deploy. This
 * script is the bridge — run it whenever you need a file to feed into a
 * mail tool.
 *
 * Output goes to `exports/waitlist/` at the repo root, which is gitignored:
 * the rows are personal data and must not end up in version control.
 *
 * Point DATABASE_URL at production to export the real list:
 *   DATABASE_URL="postgresql://…" pnpm waitlist:export
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { asc } from "drizzle-orm";
import * as XLSX from "xlsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const OUT_DIR = resolve(REPO_ROOT, "exports", "waitlist");

// @roots/db throws at import time when DATABASE_URL is missing, so the root
// .env has to be loaded before that import happens — hence the dynamic
// import inside main() below. An explicit DATABASE_URL in the environment
// still wins, which is how you point this at production.
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(resolve(REPO_ROOT, ".env"));
  } catch {
    // No .env locally — fall through to the clearer error from the client.
  }
}

const COLUMNS = ["E-post", "Namn", "Källa", "Anmäld"] as const;

function formatStockholm(date: Date): string {
  // sv-SE gives "2026-07-27 13:51" — sorts correctly and reads naturally
  // for a Swedish recipient opening the file in Excel.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function csvEscape(value: string): string {
  return /[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const { db, waitlistSignups } = await import("../src/index");

  const rows = await db
    .select({
      email: waitlistSignups.email,
      name: waitlistSignups.name,
      source: waitlistSignups.source,
      createdAt: waitlistSignups.createdAt,
    })
    .from(waitlistSignups)
    .orderBy(asc(waitlistSignups.createdAt));

  if (rows.length === 0) {
    console.log("[väntelista] Inga anmälningar än — ingen fil skapad.");
    return;
  }

  const records = rows.map((r) => ({
    "E-post": r.email,
    Namn: r.name ?? "",
    Källa: r.source,
    Anmäld: formatStockholm(r.createdAt),
  }));

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);

  const sheet = XLSX.utils.json_to_sheet(records, { header: [...COLUMNS] });
  sheet["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 16 }, { wch: 18 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Väntelista");
  const xlsxPath = resolve(OUT_DIR, `roots-vantelista-${stamp}.xlsx`);
  XLSX.writeFile(book, xlsxPath);

  // Semicolon-separated with a BOM: what Excel on a Swedish locale opens
  // straight into columns with åäö intact. Handy for mail tools that only
  // accept CSV.
  const csv = [
    COLUMNS.join(";"),
    ...records.map((r) => COLUMNS.map((c) => csvEscape(r[c])).join(";")),
  ].join("\r\n");
  const csvPath = resolve(OUT_DIR, `roots-vantelista-${stamp}.csv`);
  writeFileSync(csvPath, "\uFEFF" + csv, "utf8");

  const named = records.filter((r) => r.Namn).length;
  console.log(`[väntelista] ${rows.length} anmälningar (${named} med namn)`);
  console.log(`[väntelista] ${xlsxPath}`);
  console.log(`[väntelista] ${csvPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[väntelista] Export misslyckades:", err);
    process.exit(1);
  });
