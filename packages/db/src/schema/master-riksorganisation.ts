import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

/**
 * `master_riksorganisation` — the top of the masterdata hierarchy
 * (Riksorganisation → Segment → Organisation → Group).
 *
 * Seeded from `public/Feedback_14:5/roots_master_riksorganisationer.xlsx`
 * (~100 rows). See `docs/feedback-plans/01-master-data/01_riksorganisation_table.txt`.
 *
 * `code` is the stable join key used by the seed pipeline; `name` is the
 * canonical display value. Both are unique.
 *
 * v1: completely additive — no existing column references this table yet.
 * Consumers must gate reads/writes behind `flags.newOrgHierarchy(orgId)`
 * until backfill is complete (synthesis §13.4 expand/contract).
 */
export const masterRiksorganisation = pgTable(
  "master_riksorganisation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    type: varchar("type", { length: 50 }),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("master_riksorganisation_active_sort_idx").on(
      table.active,
      table.sortOrder
    ),
  ]
);
