import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Föreningens logga och färger, lästa från dess webbplats eller webbshop.
 * Egen tabell så att loggans bytes inte följer med i varje `select()` på
 * `organizations`.
 */
export const organizationBrands = pgTable("organization_brands", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** Huvudfärgen, #RRGGBB. */
  color: varchar("color", { length: 7 }),
  /** Alla signaturfärger i ordning, huvudfärgen först. */
  colors: jsonb("colors").$type<string[]>().notNull().default([]),
  /** Loggan som PNG, beskuren och med genomskinlig bakgrund. */
  logo: bytea("logo"),
  /** Loggan är ljus i kanten och syns bara på mörk botten. */
  logoOnDark: boolean("logo_on_dark").notNull().default(false),
  sourceUrl: varchar("source_url", { length: 300 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});
