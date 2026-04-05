CREATE TYPE "public"."user_role" AS ENUM('PUBLIC', 'CLUB_MEMBER', 'CLUB_ADMIN', 'SALES_REP', 'SALES_ADMIN', 'INTERNAL_ADMIN', 'ASSOCIATION_ADMIN', 'TEAM_LEADER', 'SELLER');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('NONE', 'PENDING', 'ISSUED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."campaign_goal_type" AS ENUM('AMOUNT', 'PACKAGES');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'ACTIVE', 'ENDED', 'SETTLED');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('BULK', 'DIRECT', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."seller_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."customer_delivery_type" AS ENUM('BULK', 'DIRECT');--> statement-breakpoint
CREATE TYPE "public"."customer_order_status" AS ENUM('DRAFT', 'PENDING', 'PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."customer_payment_method" AS ENUM('KLARNA', 'DIRECT_TO_LEADER');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'INVOICED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."subscription_interval" AS ENUM('MONTHLY', 'BIMONTHLY', 'QUARTERLY');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"org_number" varchar(20),
	"type" varchar(50) DEFAULT 'club' NOT NULL,
	"national_federation" varchar(255),
	"sport_type" varchar(100),
	"verified" boolean DEFAULT false NOT NULL,
	"fortnox_customer_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'PUBLIC' NOT NULL,
	"org_id" uuid,
	"contact_name" varchar(255),
	"phone" varchar(50),
	"personal_number" varchar(255),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"postal_code" varchar(20),
	"mfa_secret" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bundle_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_ore" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_ore" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'SEK' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_ore" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" varchar(100),
	"total_ore" integer NOT NULL,
	"fortnox_invoice_id" varchar(100),
	"invoice_status" "invoice_status" DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_ore" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sales_rep_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"valid_until" timestamp,
	"total_ore" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_fortnox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"encrypted_access_token" varchar(1024),
	"encrypted_refresh_token" varchar(1024),
	"scope" varchar(255),
	"company_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hair_analysis_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"consent_version" varchar(50) NOT NULL,
	"newsletter_consent" boolean DEFAULT false NOT NULL,
	"age_confirmed" boolean DEFAULT false NOT NULL,
	"ip_address" varchar(45),
	"idempotency_key" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hair_analysis_leads_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"goal_type" "campaign_goal_type" DEFAULT 'AMOUNT' NOT NULL,
	"goal_value" integer DEFAULT 0 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"delivery_type" "delivery_type" DEFAULT 'BULK' NOT NULL,
	"shipping_threshold_ore" integer DEFAULT 0,
	"shipping_fee_ore" integer DEFAULT 4900,
	"margin_percent" integer DEFAULT 25 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"goal_type" "campaign_goal_type" DEFAULT 'AMOUNT' NOT NULL,
	"goal_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"leader_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"invite_token" varchar(64) NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"shop_slug" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"individual_goal" integer DEFAULT 0,
	"status" "seller_status" DEFAULT 'ACTIVE' NOT NULL,
	"invite_token" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_shop_slug_unique" UNIQUE("shop_slug")
);
--> statement-breakpoint
CREATE TABLE "customer_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_ore" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"shipping_address_line1" varchar(255),
	"shipping_address_line2" varchar(255),
	"shipping_city" varchar(100),
	"shipping_postal_code" varchar(20),
	"delivery_type" "customer_delivery_type" DEFAULT 'BULK' NOT NULL,
	"payment_method" "customer_payment_method" DEFAULT 'KLARNA' NOT NULL,
	"klarna_order_id" varchar(255),
	"status" "customer_order_status" DEFAULT 'PENDING' NOT NULL,
	"total_ore" integer NOT NULL,
	"shipping_ore" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"total_sales_ore" integer DEFAULT 0 NOT NULL,
	"roots_share_ore" integer DEFAULT 0 NOT NULL,
	"team_share_ore" integer DEFAULT 0 NOT NULL,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"fortnox_invoice_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"custom_price_ore" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"shipping_address_line1" varchar(255),
	"shipping_city" varchar(100),
	"shipping_postal_code" varchar(20),
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"seller_id" uuid,
	"team_id" uuid,
	"campaign_id" uuid,
	"interval" "subscription_interval" DEFAULT 'QUARTERLY' NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"unit_price_ore" integer NOT NULL,
	"next_delivery_date" date NOT NULL,
	"last_delivery_date" date,
	"external_subscription_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_products" ADD CONSTRAINT "bundle_products_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_products" ADD CONSTRAINT "bundle_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sales_rep_id_users_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_fortnox" ADD CONSTRAINT "integration_fortnox_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_order_id_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_org_id_idx" ON "campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_goals_team_campaign_unique" ON "team_goals" USING btree ("team_id","campaign_id");--> statement-breakpoint
CREATE INDEX "teams_campaign_id_idx" ON "teams" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "teams_org_id_idx" ON "teams" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "teams_leader_id_idx" ON "teams" USING btree ("leader_id");--> statement-breakpoint
CREATE INDEX "sellers_user_id_idx" ON "sellers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sellers_team_id_idx" ON "sellers" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sellers_campaign_id_idx" ON "sellers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "customer_order_lines_order_id_idx" ON "customer_order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "customer_orders_seller_id_idx" ON "customer_orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "customer_orders_team_id_idx" ON "customer_orders" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "customer_orders_campaign_id_idx" ON "customer_orders" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "customer_orders_org_id_idx" ON "customer_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "customer_orders_status_idx" ON "customer_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_orders_klarna_order_id_idx" ON "customer_orders" USING btree ("klarna_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_campaign_team_unique_idx" ON "payouts" USING btree ("campaign_id","team_id");--> statement-breakpoint
CREATE INDEX "payouts_org_id_idx" ON "payouts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_products_campaign_product_idx" ON "campaign_products" USING btree ("campaign_id","product_id");--> statement-breakpoint
CREATE INDEX "campaign_products_campaign_id_idx" ON "campaign_products" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_email_idx" ON "subscriptions" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "subscriptions_seller_id_idx" ON "subscriptions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "subscriptions_team_id_idx" ON "subscriptions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_next_delivery_idx" ON "subscriptions" USING btree ("next_delivery_date");