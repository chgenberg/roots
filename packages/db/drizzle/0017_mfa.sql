-- Migration 0017 — tvåfaktor för roller som ser andras data
--
-- `mfa_secret` har funnits sedan 0001 och `apps/api/src/lib/mfa.ts` kunde
-- generera och verifiera koder, men filen importerades aldrig från någon
-- route. En INTERNAL_ADMIN kom alltså in på bara ett lösenord, och den
-- rollen ser samtliga föreningars försäljning och kunduppgifter.
--
-- Två kolumner behövdes för att det ska gå att slå på:
--
--   mfa_enabled_at    Skiljer en påbörjad registrering från en färdig. Utan
--                     den kan vi inte spara hemligheten medan användaren
--                     skannar QR-koden utan att samtidigt låsa ute hen om
--                     hen stänger fliken innan första koden bekräftats.
--   mfa_backup_codes  Hashade reservkoder. Utan dem blir en tappad telefon
--                     en permanent utelåsning, och då blir lösningen i
--                     praktiken att någon stänger av MFA direkt i databasen
--                     — sämre än att inte ha haft det.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfa_enabled_at" timestamp;
--> statement-breakpoint

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfa_backup_codes" text;
--> statement-breakpoint

-- Befintliga rader har mfa_secret = NULL eftersom ingen kodväg satte den.
-- Skulle någon rad ändå ha en hemlighet är den aldrig bekräftad, så den
-- lämnas som "påbörjad men inte aktiverad" — vilket NULL redan uttrycker.
