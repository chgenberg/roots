import { z } from "zod";

/**
 * Pure helpers for the masterdata seed pipeline. Kept free of `./client`
 * imports so they can be unit-tested without a Postgres connection.
 */

export const riksRowSchema = z.object({
  Riksorganisation: z.string().min(1, "name required"),
  "Typ av Riksorganisation": z.string().default(""),
});
export type RiksRow = z.infer<typeof riksRowSchema>;

export const segmentRowSchema = z.object({
  Riksorganisation: z.string().min(1),
  "Segment / Förbund": z.string().min(1),
  Typ: z.string().default(""),
});
export type SegmentRow = z.infer<typeof segmentRowSchema>;

/**
 * Parses a single line of CSV (RFC 4180-ish). Sufficient for our checked-in
 * masters which use simple text and no embedded newlines.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsv<S extends z.ZodTypeAny>(
  raw: string,
  schema: S
): z.infer<S>[] {
  const text = raw.replace(/\r\n?/g, "\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: z.infer<S>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      throw new Error(
        `[seed-masters] line ${i + 1} validation failed: ${parsed.error.message}`
      );
    }
    rows.push(parsed.data);
  }
  return rows;
}

/**
 * Deterministic slug used as `code`. Stable enough for ~100 unique Swedish
 * organisation names; collisions inside the dataset are handled via
 * `uniqueSlug` which suffixes `-2`, `-3` etc.
 */
export function slugify(input: string): string {
  return input
    .toLocaleLowerCase("sv-SE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  let candidate = base || "row";
  let n = 1;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}`.slice(0, 64);
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Build the `name → code` map for riksorganisation rows. Codes are unique
 * across the whole dataset.
 */
export function buildRiksCodeMap(rows: RiksRow[]): Map<string, string> {
  const taken = new Set<string>();
  const map = new Map<string, string>();
  for (const r of rows) {
    const code = uniqueSlug(slugify(r.Riksorganisation), taken);
    map.set(r.Riksorganisation.trim(), code);
  }
  return map;
}

/**
 * Build per-riks `segment-name → code` index. Codes are unique **within** a
 * single riksorganisation (matching the unique constraint
 * `(riksorganisation_id, code)` in `master_segment`).
 *
 * Duplicate `(riksName, segmentName)` rows in the input reuse the **same**
 * code — they represent the same logical segment, not a collision. Real
 * collisions (e.g. two different segments slugifying to the same string)
 * get `-2`, `-3` suffixes via `uniqueSlug`.
 */
export function buildSegmentCodeIndex(
  rows: SegmentRow[],
  knownRiksNames: Iterable<string>
): {
  perRiks: Map<string, Map<string, string>>;
  unknownRiks: string[];
} {
  const knownSet = new Set(Array.from(knownRiksNames));
  const perRiks = new Map<string, Map<string, string>>();
  // Separate side-table so the `perRiks` Maps stay clean of bookkeeping
  // state. Keyed by riksName since each riks has its own code namespace.
  const takenByRiks = new Map<string, Set<string>>();
  const unknownRiks: string[] = [];

  for (const seg of rows) {
    const riksName = seg.Riksorganisation.trim();
    if (!knownSet.has(riksName)) {
      unknownRiks.push(riksName);
      continue;
    }
    let perName = perRiks.get(riksName);
    if (!perName) {
      perName = new Map<string, string>();
      perRiks.set(riksName, perName);
      takenByRiks.set(riksName, new Set<string>());
    }
    const segName = seg["Segment / Förbund"].trim();
    // Duplicate row for the same (riksName, segName) — reuse the existing
    // code instead of generating a suffixed collision code.
    if (perName.has(segName)) continue;
    const takenForRiks = takenByRiks.get(riksName)!;
    const code = uniqueSlug(slugify(segName), takenForRiks);
    perName.set(segName, code);
  }
  return { perRiks, unknownRiks };
}
