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

## Presentationer

- Alltid skill `.cursor/skills/roots-presentations/SKILL.md`.
  Vit yta, mycket luft, Roots leder. 16:9 via `roots_deck.py`,
  A4 via `build_partner_avtal.py` (PDF) och `build_partner_avtal_docx.py`
  (Word). 35 % orörd.

## Drift

- Prod (roots.nu) ligger bakom preview-gate. Öppet utan cookie: `/login`, `/registrera`, `/glomt-losenord`, `/aterstall-losenord`, `/integritet`, `/villkor`, `/kalkylator`, `/feedback`.
- Cursor-tavla: `apps/api/src/lib/orchestrator/workboard.json`.
- Prod-tavla: `orchestrator_cards` / `orchestrator_runs` (Drizzle).
- Puls: var 15:e minut i API:t, plus
  `POST /v1/internal/cron/orchestrator-heartbeat` med `INTERNAL_CRON_TOKEN`.
- Admin-yta: `/portal/agenten`, bara INTERNAL_ADMIN.
