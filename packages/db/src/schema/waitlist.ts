/**
 * Pre-launch waitlist captures. Powers the password gate's "var först med
 * att veta när vi lanserar" signup form. A single deduped row per email
 * keeps the export clean for the eventual launch announcement.
 */

import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const waitlistSignups = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  // Where the signup came from (e.g. "preview-gate"). Lets us segment
  // future capture surfaces (footer, hero CTA, etc.) without a new table.
  source: varchar("source", { length: 64 }).notNull().default("preview-gate"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
