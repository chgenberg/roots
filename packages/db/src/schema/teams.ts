import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { campaigns, campaignGoalTypeEnum } from "./campaigns";
import { users } from "./users";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    inviteToken: varchar("invite_token", { length: 64 }).notNull().unique(),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("teams_campaign_id_idx").on(table.campaignId),
    index("teams_org_id_idx").on(table.orgId),
    index("teams_leader_id_idx").on(table.leaderId),
  ]
);

export const teamGoals = pgTable(
  "team_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    goalType: campaignGoalTypeEnum("goal_type").notNull().default("AMOUNT"),
    goalValue: integer("goal_value").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_goals_team_campaign_unique").on(table.teamId, table.campaignId),
  ]
);
