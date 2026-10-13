/**
 * Pre-launch waitlist captures. Powers the password gate's "var först med
 * att veta när vi lanserar" signup form. A single deduped row per email
 * keeps the export clean for the eventual launch announcement.
 */

import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    // Where the signup came from (e.g. "preview-gate"). Lets us segment
    // future capture surfaces (footer, hero CTA, etc.) without a new table.
    source: varchar("source", { length: 64 }).notNull().default("preview-gate"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    // Intresseanmälan (0023). Nullbara: äldre rader har bara e-post.
    phone: varchar("phone", { length: 32 }),
    customerType: varchar("customer_type", { length: 32 }),
    intent: varchar("intent", { length: 16 }),
    consentAt: timestamp("consent_at"),
    updatedAt: timestamp("updated_at"),
    // Steg 2 (0024). `organizationId` pekar på leaden i pipelinen.
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    organisation: varchar("organisation", { length: 255 }),
    // JSON: utm_*, referrer, landing. Läses bara av export och säljdialog.
    tracking: text("tracking"),
    completedAt: timestamp("completed_at"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("waitlist_signups_organization_id_idx").on(table.organizationId)]
);
