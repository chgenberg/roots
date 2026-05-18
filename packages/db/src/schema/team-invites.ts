import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { campaigns } from "./campaigns";
import { teams } from "./teams";
import { users } from "./users";

/**
 * `team_invites` holds the pre-team handshake created by an
 * ASSOCIATION_ADMIN before a team leader has joined the platform.
 *
 * We can't create the `teams` row up front because `teams.leader_id` is
 * NOT NULL, and we don't want a placeholder leader pretending to be the
 * coach. Instead, the association admin POSTs to
 * `/v1/association/team-invites` and we store:
 *   - the team's *intended* metadata (name, campaign, optional email),
 *   - a one-time `token` (single-use, expires in 14 days),
 *   - and (after the leader claims it) a back-reference to the
 *     `teams.id` that was actually created.
 *
 * The claim endpoint validates the token, creates a real user with
 * role=TEAM_LEADER, creates the `teams` row with that user as leader,
 * and stamps `used_at` + `used_by_team_id` here.
 */
export const teamInvites = pgTable(
  "team_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    teamName: varchar("team_name", { length: 255 }).notNull(),
    invitedEmail: varchar("invited_email", { length: 255 }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    usedAt: timestamp("used_at"),
    usedByTeamId: uuid("used_by_team_id").references(() => teams.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("team_invites_org_id_idx").on(table.orgId),
    index("team_invites_campaign_id_idx").on(table.campaignId),
    index("team_invites_used_at_idx").on(table.usedAt),
  ]
);
