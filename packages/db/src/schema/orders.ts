import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { products } from "./products";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "NONE",
  "PENDING",
  "ISSUED",
  "PAID",
  "CANCELLED",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  quoteId: uuid("quote_id"),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).unique(),
  totalOre: integer("total_ore").notNull(),
  fortnoxInvoiceId: varchar("fortnox_invoice_id", { length: 100 }),
  invoiceStatus: invoiceStatusEnum("invoice_status").notNull().default("NONE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("orders_org_id_idx").on(table.orgId),
  index("orders_user_id_idx").on(table.userId),
  index("orders_created_at_idx").on(table.createdAt),
]);

export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitPriceOre: integer("unit_price_ore").notNull(),
});
