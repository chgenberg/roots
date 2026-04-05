import {
  pgTable,
  uuid,
  varchar,
  integer,
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payouts_campaign_team_unique_idx").on(table.campaignId, table.teamId),
    index("payouts_org_id_idx").on(table.orgId),
  ]
);
