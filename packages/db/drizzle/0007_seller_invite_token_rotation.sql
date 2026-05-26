-- MASTERPLAN_01 KC3.4: rotation + expiry + max-uses för seller invite-token.
--
-- Bakgrund: teams.invite_token har historiskt varit permanent + multi-use.
-- En läckt token (skärmbild, gammal Instagram-post) kunde användas för
-- evigt och låta vem som helst registrera sig som säljare i laget.
--
-- Strategi: alla nya kolumner är nullable och backward-compatible.
-- Existerande rader får:
--   - expires_at = NULL  → ingen utgång (samma beteende som tidigare)
--   - max_uses   = NULL  → obegränsat (samma beteende som tidigare)
--   - use_count  = 0     → börjar räkna nya användningar från och med nu
--   - created_at = NOW() → "rotated_at"; UI kan visa "Skapad: <datum>"
--
-- Det gör migreringen säker att köra på prod utan att invalidera
-- några levande invites. När TL/admin nästa gång roterar tokenen
-- (POST /v1/teams/:id/invite-token) sätts expires_at + max_uses.

ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "invite_token_expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "invite_token_max_uses" integer,
  ADD COLUMN IF NOT EXISTS "invite_token_use_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "invite_token_created_at" timestamp NOT NULL DEFAULT now();
