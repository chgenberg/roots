import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const hairAnalysisLeads = pgTable(
  "hair_analysis_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    consentVersion: varchar("consent_version", { length: 50 }).notNull(),
    newsletterConsent: boolean("newsletter_consent").notNull().default(false),
    ageConfirmed: boolean("age_confirmed").notNull().default(false),
    ipAddress: varchar("ip_address", { length: 45 }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Purge-jobbet raderar leads äldre än retention-fönstret.
    index("hair_analysis_leads_created_at_idx").on(table.createdAt),
  ]
);
