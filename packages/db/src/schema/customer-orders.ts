import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { campaigns } from "./campaigns";
import { teams } from "./teams";
import { sellers } from "./sellers";
import { products } from "./products";

export const customerOrderStatusEnum = pgEnum("customer_order_status", [
  "DRAFT",
  "PENDING",
  "PAID",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
]);

export const customerPaymentMethodEnum = pgEnum("customer_payment_method", [
  "KLARNA",
  "DIRECT_TO_LEADER",
]);

export const customerDeliveryTypeEnum = pgEnum("customer_delivery_type", [
  "BULK",
  "DIRECT",
]);

export const customerOrders = pgTable(
  "customer_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }),
    shippingAddressLine1: varchar("shipping_address_line1", { length: 255 }),
    shippingAddressLine2: varchar("shipping_address_line2", { length: 255 }),
    shippingCity: varchar("shipping_city", { length: 100 }),
    shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
    deliveryType: customerDeliveryTypeEnum("delivery_type")
      .notNull()
      .default("BULK"),
    paymentMethod: customerPaymentMethodEnum("payment_method")
      .notNull()
      .default("KLARNA"),
    // Den faktiska betalinstrument-typen som kunden valde inne i Klarna
    // (t.ex. "swish", "card", "pay_later"). Klarna är processorn;
    // detta fält säger HUR kunden betalade. Sätts från Klarnas order-
    // snapshot (initial_payment_method). För manuella ordrar lagda av
    // säljaren själv används t.ex. "swish" eller "cash".
    selectedPaymentMethod: varchar("selected_payment_method", { length: 40 }),
    klarnaOrderId: varchar("klarna_order_id", { length: 255 }),
    status: customerOrderStatusEnum("status").notNull().default("PENDING"),
    totalOre: integer("total_ore").notNull(),
    shippingOre: integer("shipping_ore").notNull().default(0),
    note: text("note"),
    // Säljperiod: true = ordern lades inom kampanjens aktiva period och
    // räknas i topplistor/statistik. false = lagd utanför perioden
    // ("försäljningen kan alltid pågå, men räknas inte i listorna").
    countsTowardStats: boolean("counts_toward_stats").notNull().default(true),
    // Manuell order lagd av säljaren själv (kontant/Swish vid dörren),
    // till skillnad från en kund som handlat online via shoppen.
    isManual: boolean("is_manual").notNull().default(false),
    placedByUserId: uuid("placed_by_user_id"),
    // Leveransspårning för BULK→klubb och DIRECT→kund.
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    // P2.13 (audit 2026-05-26): klient-genererad nyckel (sha256 av
    // body) som dedup:ar /v1/checkout/create-retries. Unikt index i
    // 0010-migrationen.
    idempotencyKey: varchar("idempotency_key", { length: 120 }),
    // P2.17 (audit 2026-05-26): dedup av bekräftelse-mail över
    // process-replicas. Sätts atomiskt i samma UPDATE som flyttar
    // status → PAID-flödets follow-up.
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("customer_orders_seller_id_idx").on(table.sellerId),
    index("customer_orders_team_id_idx").on(table.teamId),
    index("customer_orders_campaign_id_idx").on(table.campaignId),
    index("customer_orders_org_id_idx").on(table.orgId),
    index("customer_orders_status_idx").on(table.status),
    index("customer_orders_klarna_order_id_idx").on(table.klarnaOrderId),
    // P3.21 (audit 2026-05-26): notification + dashboard queries gör
    // ofta WHERE org_id = ? AND status = ? ORDER BY created_at DESC.
    // Pre-push fix: matcha SQL-migrationen 0011 (DESC på created_at).
    index("customer_orders_org_status_created_idx").on(
      table.orgId,
      table.status,
      table.createdAt.desc()
    ),
    // Pre-push fix 2026-05-26: schema-drift mellan migration 0010 (som
    // skapar partial UNIQUE INDEX WHERE idempotency_key IS NOT NULL)
    // och Drizzle-schemat. Deklarera samma index här så drizzle-kit
    // inte tror att indexet saknas och försöker återskapa det.
    uniqueIndex("customer_orders_idempotency_key_uniq")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  ]
);

export const customerOrderLines = pgTable(
  "customer_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => customerOrders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull(),
    unitPriceOre: integer("unit_price_ore").notNull(),
  },
  (table) => [
    index("customer_order_lines_order_id_idx").on(table.orderId),
  ]
);
