import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Inställningar som gäller hela Roots och som bara intern admin ändrar,
 * t.ex. fraktavgiften vid hemleverans (nyckel `shipping`). En rad per
 * nyckel; saknas raden är inställningen inte bestämd.
 */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});
