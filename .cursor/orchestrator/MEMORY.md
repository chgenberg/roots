# MEMORY

Hållbart. Bara fakta som gäller över veckor. Aldrig hemligheter
(anslutningssträngar, nycklar, cron-token, lösen).

## Hus

- Namn: Roots (roots.nu). Insamling med schampoo. Klubbandel 35 %.
- Vad agenten får göra själv: läsa kartan, lägga kort, larma, laga det
  som redan har en Hand med grind `none`.
- Vad som alltid kräver ja: deploy, mejl med grind, pengar, allt irreversibelt.

## Grindar

- `irreversible` är: utbetalning (PAID), Fortnox-skick, banköverföring.
- Mejlpaus-env: `FEATURE_EMAIL_DISABLED=true`.
- Deploy-gate: bug-hunt utan CRITICAL/HIGH + explicit ja. Push till
  `main` deployar webben.

## Drift

- Cursor-tavla: `apps/api/src/lib/orchestrator/workboard.json`.
- Prod-tavla: `orchestrator_cards` / `orchestrator_runs` (Drizzle).
- Puls: var 15:e minut i API:t, plus
  `POST /v1/internal/cron/orchestrator-heartbeat` med `INTERNAL_CRON_TOKEN`.
- Admin-yta: `/portal/agenten`, bara INTERNAL_ADMIN.
