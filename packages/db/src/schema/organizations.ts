import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { masterRiksorganisation } from "./master-riksorganisation";
import { masterSegment } from "./master-segment";

/**
 * `organizations` is the canonical primary table for klubbar/föreningar.
 *
 * The columns below are split in two groups:
 *  - **Legacy (pre-2026):** `name`, `type`, `national_federation`, `sport_type`,
 *    `verified`, `fortnox_customer_id`. These keep their current behavior so
 *    nothing in production breaks.
 *  - **Masterdata v1 (Fas 1, synthesis §6 / feedback-plan 01_organization_upgrade):**
 *    All other columns. They are **nullable** by design and only consumed by code
 *    paths gated behind `flags.newOrgHierarchy(orgId)`. Existing inserts/selects
 *    work unchanged.
 *
 * `riksorganisationId` / `segmentId` reference the master tables in
 * `master-riksorganisation.ts` / `master-segment.ts` (added in migration 0003).
 * `assignedAsmUserId` references `users(id)` at the DB level (declared in the SQL
 * migration with `ON DELETE SET NULL`) — kept out of the Drizzle reference graph
 * to avoid a circular import with `users.ts`.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    orgNumber: varchar("org_number", { length: 20 }),
    type: varchar("type", { length: 50 }).notNull().default("club"),
    nationalFederation: varchar("national_federation", { length: 255 }),
    sportType: varchar("sport_type", { length: 100 }),
    // Godkänd för publik försäljning. Se apps/api/src/lib/org-approval.ts:
    // registrering är fri, men kassan öppnar först när någon hos oss tittat
    // på föreningen — annars kan vem som helst sälja i en riktig förenings
    // namn.
    verified: boolean("verified").notNull().default(false),
    verifiedAt: timestamp("verified_at"),
    verifiedByUserId: uuid("verified_by_user_id"),
    fortnoxCustomerId: varchar("fortnox_customer_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // ── Masterdata v1 (nullable, flag-gated reads/writes) ────────
    displayName: varchar("display_name", { length: 255 }),
    normalizedName: varchar("normalized_name", { length: 255 }),
    organizationType: varchar("organization_type", { length: 40 }),
    riksorganisationId: uuid("riksorganisation_id").references(
      () => masterRiksorganisation.id,
      { onDelete: "set null" }
    ),
    segmentId: uuid("segment_id").references(() => masterSegment.id, {
      onDelete: "set null",
    }),
    municipality: varchar("municipality", { length: 120 }),
    region: varchar("region", { length: 120 }),
    postalCode: varchar("postal_code", { length: 16 }),
    website: varchar("website", { length: 255 }),
    crmStatus: varchar("crm_status", { length: 40 }),
    leadSource: varchar("lead_source", { length: 40 }),
    potentialScore: integer("potential_score"),
    assignedAsmUserId: uuid("assigned_asm_user_id"),
  },
  (table) => [
    index("organizations_normalized_name_idx").on(table.normalizedName),
    index("organizations_assigned_asm_user_id_idx").on(table.assignedAsmUserId),
    index("organizations_crm_status_idx").on(table.crmStatus),
    index("organizations_segment_id_idx").on(table.segmentId),
    index("organizations_riksorganisation_id_idx").on(table.riksorganisationId),
  ]
);
