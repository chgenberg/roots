import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { masterRiksorganisation } from "./master-riksorganisation";

/**
 * `master_segment` — the second level of the masterdata hierarchy
 * (Riksorganisation → **Segment / Förbund** → Organisation → Group).
 *
 * Seeded from `public/Feedback_14:5/roots_segment_master_rekommenderad.xlsx`
 * (~110 rows). See `docs/feedback-plans/01-master-data/02_segment_table.txt`.
 *
 * v1 rules:
 *  - Each segment belongs to exactly **one** riksorganisation.
 *  - `(riksorganisation_id, name)` and `(riksorganisation_id, code)` are
 *    unique — the same segment name can live under two riksorgs as two rows.
 *  - `type` is kept as `varchar(50)` in v1 instead of a `pgEnum`. The Excel
 *    set is locked at seed time and validated by the import script
 *    (synthesis §14.2 — additivt först, ENUM senare när värdena är låsta).
 *  - FK on `riksorganisation_id` is `ON DELETE RESTRICT` so a riksorg with
 *    segments can't be removed accidentally.
 */
export const masterSegment = pgTable(
  "master_segment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riksorganisationId: uuid("riksorganisation_id")
      .notNull()
      .references(() => masterRiksorganisation.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    type: varchar("type", { length: 50 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("master_segment_riks_name_uq").on(
      table.riksorganisationId,
      table.name
    ),
    uniqueIndex("master_segment_riks_code_uq").on(
      table.riksorganisationId,
      table.code
    ),
    index("master_segment_active_idx").on(table.active),
  ]
);
