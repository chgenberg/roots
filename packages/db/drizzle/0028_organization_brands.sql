-- Föreningens logga och färger för shop, dashboards och inbjudningar.
CREATE TABLE IF NOT EXISTS "organization_brands" (
  "org_id" uuid PRIMARY KEY NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "color" varchar(7),
  "colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "logo" bytea,
  "logo_on_dark" boolean DEFAULT false NOT NULL,
  "source_url" varchar(300),
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
