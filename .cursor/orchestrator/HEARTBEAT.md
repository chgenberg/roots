# HEARTBEAT

Kör när någon skriver `/loop` mot den här filen, eller när
`POST /v1/internal/cron/orchestrator-heartbeat` tickar i prod.
Svara `HEARTBEAT_OK` om inget behöver ett kort.

Efter att kort öppnats kör `runSafeHands` i
`apps/api/src/lib/orchestrator/hands.ts` samma tick — plattformen
lagar det den redan kan.

## Checklista

1. **Mejlpaus på** (`FEATURE_EMAIL_DISABLED=true`) → kort `email-paused`
   (domän `email`, grind `email`). Ingen Hand. Lyft inte flaggan.
2. **Utbetalningar PENDING** → kort `pending-payouts` (domän `money`,
   grind `money`). Ingen Hand. Markera inte PAID.
3. **Schemalagt jobb tyst** → kort `stale-job:<name>` (domän `admin`,
   grind `none`). Ingen Hand. Starta inte jobbet om det är irreversible.
4. **Föreningar väntar på granskning** → kort `pending-org-review`
   (domän `admin`, grind `none`). Ingen Hand. Godkänn inte föreningen.
5. **Workboard-blockers** med grind `deploy | irreversible | money` →
   lämna. Vänta på en människa.
6. Villkor som är borta → flytta kortet till `done`.

## Aldrig på ett tick

Deploy, irreversible, lyfta mejlpaus, sätta pris, skicka outreach.
