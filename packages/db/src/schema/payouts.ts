import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { campaigns } from "./campaigns";
import { teams } from "./teams";

export const payoutStatusEnum = pgEnum("payout_status", [
  "PENDING",
  "INVOICED",
  "PAID",
]);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    totalSalesOre: integer("total_sales_ore").notNull().default(0),
    rootsShareOre: integer("roots_share_ore").notNull().default(0),
    teamShareOre: integer("team_share_ore").notNull().default(0),
    status: payoutStatusEnum("status").notNull().default("PENDING"),
    fortnoxInvoiceId: varchar("fortnox_invoice_id", { length: 100 }),
    /**
     * MASTERPLAN_01 KC1.5: PAID-metadata. Sätts av
     * PATCH /v1/payouts/:id/status. Alla tre är nullable så befintliga
     * rader behåller sin sanning — endast nya PAID-transitioner skriver.
     * paidByUserId refererar users(id) i SQL men hålls utanför Drizzle-
     * referensgrafen för att undvika circular import (samma mönster som
     * organizations.assignedAsmUserId).
     */
    paidAt: timestamp("paid_at"),
    paidByUserId: uuid("paid_by_user_id"),
    paymentReference: varchar("payment_reference", { length: 64 }),
    /**
     * En order återbetalades eller avbokades efter att utbetalningen
     * fakturerats eller betalats. Beloppen på raden rörs aldrig då; flaggan
     * säger att en människa behöver reglera mellanskillnaden med föreningen.
     * Mellanskillnaden räknas fram vid läsning och sparas inte.
     *
     * Raden behöver hanteras när `reviewRequiredAt` är satt och är senare
     * än `reviewResolvedAt` (eller ingen kvittering finns).
     */
    reviewRequiredAt: timestamp("review_required_at"),
    reviewResolvedAt: timestamp("review_resolved_at"),
    reviewResolvedByUserId: uuid("review_resolved_by_user_id"),
    reviewNote: text("review_note"),
    /**
     * Vad som var rätt andel när flaggan senast kvitterades. En senare
     * återbetalning flaggar raden igen; då syns hur mycket av
     * mellanskillnaden som redan är reglerad och hur mycket som är nytt.
     */
    reviewResolvedTeamShareOre: integer("review_resolved_team_share_ore"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payouts_campaign_team_unique_idx").on(table.campaignId, table.teamId),
    index("payouts_org_id_idx").on(table.orgId),
  ]
);
