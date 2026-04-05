import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { teams } from "./teams";
import { campaigns } from "./campaigns";

export const sellerStatusEnum = pgEnum("seller_status", [
  "ACTIVE",
  "INACTIVE",
]);

export const sellers = pgTable(
  "sellers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    shopSlug: varchar("shop_slug", { length: 255 }).notNull().unique(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    individualGoal: integer("individual_goal").default(0),
    status: sellerStatusEnum("status").notNull().default("ACTIVE"),
    inviteToken: varchar("invite_token", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sellers_user_id_idx").on(table.userId),
    index("sellers_team_id_idx").on(table.teamId),
    index("sellers_campaign_id_idx").on(table.campaignId),
  ]
);
