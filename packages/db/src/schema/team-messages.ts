import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { teams } from "./teams";
import { users } from "./users";
import { sellers } from "./sellers";

/**
 * In-app chat mellan lagledare och säljare.
 *
 * Modell:
 *   - Varje rad är ett meddelande i ett lag (`teamId`).
 *   - `senderUserId` är den som skrev (lagledare eller säljarens user).
 *   - `recipientSellerId` styr synlighet:
 *        NULL  → broadcast till hela laget (alla säljare ser det).
 *        satt  → privat tråd mellan lagledaren och den säljaren.
 *   - `readAt` sätts när mottagaren har sett meddelandet (oläst-räknare).
 *
 * Vi lägger orgId redundant för enkel tenancy-filtrering och framtida
 * admin-insyn. Polling i UI:t läser senaste N rader per tråd.
 */
export const teamMessages = pgTable(
  "team_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id),
    recipientSellerId: uuid("recipient_seller_id").references(() => sellers.id),
    body: text("body").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_messages_team_id_idx").on(table.teamId),
    index("team_messages_recipient_seller_id_idx").on(table.recipientSellerId),
    index("team_messages_team_created_idx").on(
      table.teamId,
      table.createdAt.desc()
    ),
  ]
);
