import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { sellers } from "./sellers";
import { teams } from "./teams";
import { campaigns } from "./campaigns";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
]);

export const subscriptionIntervalEnum = pgEnum("subscription_interval", [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }),
    shippingAddressLine1: varchar("shipping_address_line1", { length: 255 }),
    shippingCity: varchar("shipping_city", { length: 100 }),
    shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull().default(1),
    sellerId: uuid("seller_id").references(() => sellers.id),
    teamId: uuid("team_id").references(() => teams.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    interval: subscriptionIntervalEnum("interval").notNull().default("QUARTERLY"),
    status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
    unitPriceOre: integer("unit_price_ore").notNull(),
    nextDeliveryDate: date("next_delivery_date").notNull(),
    lastDeliveryDate: date("last_delivery_date"),
    externalSubscriptionId: varchar("external_subscription_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_customer_email_idx").on(table.customerEmail),
    index("subscriptions_seller_id_idx").on(table.sellerId),
    index("subscriptions_team_id_idx").on(table.teamId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_next_delivery_idx").on(table.nextDeliveryDate),
  ]
);
