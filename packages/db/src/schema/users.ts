import { pgTable, uuid, varchar, timestamp, pgEnum, index, integer } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const roleEnum = pgEnum("user_role", [
  "PUBLIC",
  "CLUB_MEMBER",
  "CLUB_ADMIN",
  "SALES_REP",
  "SALES_ADMIN",
  "INTERNAL_ADMIN",
  "ASSOCIATION_ADMIN",
  "TEAM_LEADER",
  "SELLER",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("PUBLIC"),
  orgId: uuid("org_id").references(() => organizations.id),
  contactName: varchar("contact_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  personalNumber: varchar("personal_number", { length: 255 }),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  mfaSecret: varchar("mfa_secret", { length: 255 }),
  // Minor-protection fields. Added so we can show a guardian-consent gate
  // before a seller under 16 goes public. Nullable everywhere so existing
  // rows continue to validate.
  birthYear: integer("birth_year"),
  guardianUserId: uuid("guardian_user_id"),
  guardianConsentAt: timestamp("guardian_consent_at"),
  // MASTERPLAN_01 KC2.7: GDPR account-deletion lifecycle. Alla nullable.
  // Användaren begär → deletionRequestedAt + scheduledDeletionAt (now+14d).
  // Inom 14d kan de ångra → båda nollas. Efter scheduled-tiden anonymiserar
  // worker:n PII och sätter deletedAt. Order-historik bevaras anonymiserat
  // för bokföringslagen (7 år).
  deletionRequestedAt: timestamp("deletion_requested_at"),
  scheduledDeletionAt: timestamp("scheduled_deletion_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("users_org_id_idx").on(table.orgId),
  index("users_guardian_idx").on(table.guardianUserId),
  index("users_scheduled_deletion_at_idx").on(table.scheduledDeletionAt),
  index("users_deleted_at_idx").on(table.deletedAt),
]);
