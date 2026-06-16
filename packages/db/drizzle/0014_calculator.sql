-- Migration 0014 — Föreningskalkylator (räknesnurra)
--
-- Två nya tabeller för säljarnas förtjänst-kalkyl:
--   1. calculator_links — delbar, prospekt-specifik länk som en säljare
--      skapar. `token` är den publika nyckeln i URL:en. Ingen FK till
--      organizations: föreningen är oftast ett prospekt utan konto.
--   2. calculator_leads — mjuk lead-capture när föreningen själv räknar
--      och lämnar mejl. `inputs_snapshot`/`presets` lagras som jsonb.
--
-- Idempotent (IF NOT EXISTS) i linje med tidigare migrationer.

CREATE TABLE IF NOT EXISTS "calculator_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" varchar(64) NOT NULL UNIQUE,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "association_name" varchar(160) NOT NULL,
  "presets" jsonb NOT NULL,
  "view_count" integer NOT NULL DEFAULT 0,
  "last_viewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "calculator_links_created_by_idx"
  ON "calculator_links" ("created_by_user_id");

CREATE TABLE IF NOT EXISTS "calculator_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "calculator_link_id" uuid NOT NULL REFERENCES "calculator_links"("id"),
  "email" varchar(255) NOT NULL,
  "contact_name" varchar(160),
  "message" varchar(2000),
  "inputs_snapshot" jsonb NOT NULL,
  "computed_earnings_ore" integer NOT NULL DEFAULT 0,
  "newsletter_consent" boolean NOT NULL DEFAULT false,
  "ip_address" varchar(45),
  "idempotency_key" varchar(64) UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "calculator_leads_link_idx"
  ON "calculator_leads" ("calculator_link_id");
CREATE INDEX IF NOT EXISTS "calculator_leads_link_created_idx"
  ON "calculator_leads" ("calculator_link_id", "created_at" DESC);
