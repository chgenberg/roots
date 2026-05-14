import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { masterRiksorganisation } from "../schema/master-riksorganisation";
import { masterSegment } from "../schema/master-segment";
import {
  buildRiksCodeMap,
  buildSegmentCodeIndex,
  parseCsv,
  riksRowSchema,
  segmentRowSchema,
} from "./util";

/**
 * Idempotent seed for `master_riksorganisation` and `master_segment`.
 *
 * Reads checked-in CSVs under `packages/db/data/master/`:
 *   - `riksorganisationer.csv`  (114 rows)
 *   - `segment_master.csv`      (110 rows)
 *
 * Uses natural keys (`code`) for upserts so the script is safe to re-run
 * after Excel-side edits. V1 is **additive-only**: no soft-deletes — rows
 * removed from the CSV are left in place until a future tombstone strategy
 * is implemented (feedback-plan 01/04 "Soft delete / borttagna rader").
 *
 * Run with:
 *   pnpm --filter @roots/db db:seed:masters
 */

const HERE = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url), "..");
  } catch {
    return resolve(process.cwd(), "src", "seed-masters");
  }
})();
const DATA_DIR = resolve(HERE, "..", "..", "data", "master");

export async function seedMasters(): Promise<{
  riksCount: number;
  segmentCount: number;
  segmentSkipped: number;
}> {
  const riksRows = parseCsv(
    readFileSync(resolve(DATA_DIR, "riksorganisationer.csv"), "utf8"),
    riksRowSchema
  );
  const segmentRows = parseCsv(
    readFileSync(resolve(DATA_DIR, "segment_master.csv"), "utf8"),
    segmentRowSchema
  );

  const codeMap = buildRiksCodeMap(riksRows);

  for (let i = 0; i < riksRows.length; i++) {
    const r = riksRows[i];
    const name = r.Riksorganisation.trim();
    const code = codeMap.get(name)!;
    const typeValue = r["Typ av Riksorganisation"]?.trim() || null;
    await db
      .insert(masterRiksorganisation)
      .values({
        name,
        code,
        type: typeValue,
        active: true,
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: masterRiksorganisation.code,
        set: {
          name,
          type: typeValue,
          active: true,
          sortOrder: i,
        },
      });
  }

  const allRiks = await db
    .select({
      id: masterRiksorganisation.id,
      code: masterRiksorganisation.code,
    })
    .from(masterRiksorganisation);
  const idByCode = new Map(allRiks.map((r) => [r.code, r.id]));

  const knownRiksNames = Array.from(codeMap.keys());
  const { perRiks, unknownRiks } = buildSegmentCodeIndex(
    segmentRows,
    knownRiksNames
  );

  for (const seg of segmentRows) {
    const riksName = seg.Riksorganisation.trim();
    if (!perRiks.has(riksName)) continue;
    const riksCode = codeMap.get(riksName)!;
    const riksId = idByCode.get(riksCode);
    if (!riksId) continue;

    const segCode = perRiks.get(riksName)!.get(seg["Segment / Förbund"].trim());
    if (!segCode) continue;
    const typeValue = seg.Typ?.trim() || null;

    await db
      .insert(masterSegment)
      .values({
        riksorganisationId: riksId,
        name: seg["Segment / Förbund"].trim(),
        code: segCode,
        type: typeValue,
        active: true,
      })
      .onConflictDoUpdate({
        target: [masterSegment.riksorganisationId, masterSegment.code],
        set: {
          name: seg["Segment / Förbund"].trim(),
          type: typeValue,
          active: true,
          updatedAt: sql`now()`,
        },
      });
  }

  if (unknownRiks.length > 0) {
    const sample = Array.from(new Set(unknownRiks)).slice(0, 5).join(", ");
    console.warn(
      `[seed-masters] ${unknownRiks.length} segment row(s) referenced unknown riksorganisation: ${sample}${
        unknownRiks.length > 5 ? " …" : ""
      }`
    );
  }

  return {
    riksCount: riksRows.length,
    segmentCount: segmentRows.length - unknownRiks.length,
    segmentSkipped: unknownRiks.length,
  };
}

const isDirectRun = (() => {
  try {
    const here = fileURLToPath(import.meta.url);
    return process.argv[1] === here;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  seedMasters()
    .then((res) => {
      console.log(
        `[seed-masters] upserted ${res.riksCount} riksorganisation rows, ${res.segmentCount} segment rows (skipped ${res.segmentSkipped})`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[seed-masters] failed:", err);
      process.exit(1);
    });
}
