import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Föreningskalkylator (räknesnurra).
 *
 * `calculator_links` — en delbar, prospekt-specifik kalkyl-länk som en
 * säljare skapar i portalen. Ingen FK till `organizations`: föreningen är
 * oftast ett prospekt som ännu inte finns i systemet, så vi sparar bara
 * namnet + de antaganden (presets) säljaren förkonfigurerat. `token` är
 * den publika nyckeln i URL:en (/kalkylator/:token).
 *
 * `calculator_leads` — mjuk lead-capture: när föreningen själv räknar och
 * lämnar sin mejl ("skicka sammanfattning / bli kontaktad") sparas en rad
 * här och säljaren ser den i sin notisfeed. `inputs_snapshot` fryser de
 * värden de räknade med så säljaren vet vad föreningen själv kom fram till.
 */
export const calculatorLinks = pgTable(
  "calculator_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    associationName: varchar("association_name", { length: 160 }).notNull(),
    presets: jsonb("presets").notNull(),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("calculator_links_created_by_idx").on(table.createdByUserId),
  ]
);

export const calculatorLeads = pgTable(
  "calculator_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calculatorLinkId: uuid("calculator_link_id")
      .notNull()
      .references(() => calculatorLinks.id),
    email: varchar("email", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),
    message: varchar("message", { length: 2000 }),
    inputsSnapshot: jsonb("inputs_snapshot").notNull(),
    computedEarningsOre: integer("computed_earnings_ore").notNull().default(0),
    newsletterConsent: boolean("newsletter_consent").notNull().default(false),
    ipAddress: varchar("ip_address", { length: 45 }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("calculator_leads_link_idx").on(table.calculatorLinkId),
    index("calculator_leads_link_created_idx").on(
      table.calculatorLinkId,
      table.createdAt.desc()
    ),
  ]
);
