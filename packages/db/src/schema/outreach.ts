/**
 * Lead-mejlagenten: personliga första mejl till föreningar.
 *
 * `outreach_senders` — den som mejlet kommer från (t.ex. Niclas eller Kent),
 * med egen mall. Mejlet skickas från avsändarens roots.nu-adress och svaren
 * går direkt till hens inkorg; agenten läser inga svar.
 *
 * `outreach_leads` — en förening per rad, importerad från avsändarens Excel.
 * `token` är nyckeln i förslagslänken (/f/:token) som leder till /prova med
 * föreningens namn och logotyp, och räknar när förslaget öppnas.
 *
 * Ett mejl skickas aldrig utan att en människa godkänt det och sedan
 * uttryckligen tryckt Skicka, och inte alls medan mejl är pausade.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const outreachSenders = pgTable("outreach_senders", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Säljarkonto som får se och skicka avsändarens leads. Null = bara intern admin. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  title: varchar("title", { length: 120 }).notNull().default("Föreningsrepresentant"),
  phone: varchar("phone", { length: 40 }),
  /** Avsändaradress (måste vara på en domän verifierad i Resend) och svarsadress. */
  email: varchar("email", { length: 255 }).notNull(),
  subjectTemplate: varchar("subject_template", { length: 300 }).notNull(),
  bodyTemplate: text("body_template").notNull(),
  dailyCap: integer("daily_cap").notNull().default(40),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const outreachLeads = pgTable(
  "outreach_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => outreachSenders.id, { onDelete: "cascade" }),
    orgName: varchar("org_name", { length: 200 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),
    email: varchar("email", { length: 255 }).notNull(),
    website: varchar("website", { length: 300 }),
    memberCount: integer("member_count"),
    packagesPerMember: integer("packages_per_member").notNull().default(6),
    packagePriceKr: integer("package_price_kr").notNull().default(399),
    token: varchar("token", { length: 32 }).notNull().unique(),
    /** draft | approved | sent | replied | meeting | declined | failed */
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    /** Egen ämnesrad/text för just den här föreningen. Null = avsändarens mall. */
    subjectOverride: varchar("subject_override", { length: 300 }),
    bodyOverride: text("body_override"),
    note: text("note"),
    approvedAt: timestamp("approved_at"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at"),
    providerId: varchar("provider_id", { length: 120 }),
    lastError: text("last_error"),
    proposalOpenCount: integer("proposal_open_count").notNull().default(0),
    proposalOpenedAt: timestamp("proposal_opened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("outreach_leads_sender_email_idx").on(table.senderId, table.email),
    index("outreach_leads_sender_status_idx").on(table.senderId, table.status),
    index("outreach_leads_sent_at_idx").on(table.sentAt),
  ]
);
