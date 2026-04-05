import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const integrationFortnox = pgTable("integration_fortnox", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  encryptedAccessToken: varchar("encrypted_access_token", { length: 1024 }),
  encryptedRefreshToken: varchar("encrypted_refresh_token", { length: 1024 }),
  scope: varchar("scope", { length: 255 }),
  companyId: varchar("company_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
