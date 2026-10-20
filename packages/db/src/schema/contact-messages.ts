/**
 * Meddelanden från kontaktformuläret på /kontakt. Sparas alltid, även när
 * mejlutskick är pausat (`FEATURE_EMAIL_DISABLED`), så att inget försvinner.
 * Läses av intern admin på /portal/feedback.
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 300 }).notNull(),
    message: text("message").notNull(),
    locale: varchar("locale", { length: 8 }).notNull().default("sv"),
    emailed: boolean("emailed").notNull().default(false),
    handledAt: timestamp("handled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("contact_messages_created_at_idx").on(table.createdAt)]
);
