import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  orgNumber: varchar("org_number", { length: 20 }),
  type: varchar("type", { length: 50 }).notNull().default("club"),
  nationalFederation: varchar("national_federation", { length: 255 }),
  sportType: varchar("sport_type", { length: 100 }),
  verified: boolean("verified").notNull().default(false),
  fortnoxCustomerId: varchar("fortnox_customer_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
