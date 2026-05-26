import { pgTable, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Scout fix 2026-05-26 (DB HIGH-003): tidigare saknades FK helt mot
  // users(id). Migration 0012 lägger constraint med ON DELETE CASCADE
  // så orphan-sessions inte kvarstår vid hård user-delete.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sessions_expires_at_idx").on(table.expiresAt),
]);
