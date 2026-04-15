import {
  pgTable,
  uuid,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { products } from "./products";

export const quoteStatusEnum = pgEnum("quote_status", [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  salesRepId: uuid("sales_rep_id")
    .notNull()
    .references(() => users.id),
  status: quoteStatusEnum("status").notNull().default("DRAFT"),
  validUntil: timestamp("valid_until"),
  totalOre: integer("total_ore").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("quotes_org_id_idx").on(table.orgId),
  index("quotes_sales_rep_id_idx").on(table.salesRepId),
  index("quotes_status_idx").on(table.status),
]);

export const quoteLines = pgTable("quote_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitPriceOre: integer("unit_price_ore").notNull(),
});
