# MEMORY

Hållbart. Bara fakta som gäller över veckor. Aldrig hemligheter
(anslutningssträngar, nycklar, cron-token, lösen).

## Hus

- Namn: Roots (roots.nu). Insamling med schampoo. Klubbandel 35 %.
- Paketet i UI heter Roots Premiumpaket (399 kr, tre flaskor). Inga Exclusive/Basic-SKU:er.
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

- Prod (roots.nu) ligger bakom preview-gate. Öppet utan cookie: `/login`, `/registrera`, `/glomt-losenord`, `/aterstall-losenord`, `/integritet`, `/villkor`, `/kalkylator`, `/feedback`, `/konto`.
- `/installningar` är rollgrindad (säljare/lag/förening/intern).
- Preview-cookie och token-hash: `PREVIEW_COOKIE_NAME`, `PREVIEW_TOKEN_PREFIX`, `PREVIEW_TOKEN_HEX_LENGTH` i `@roots/contracts`.
- Boot: `STRIPE_WEBHOOK_SECRET` krävs i prod bara när `STRIPE_SECRET_KEY` är `sk_live_`. Testnyckel varnas.
- Kanonisk sajt-URL är `https://roots.nu`. `roots.se` är inte fallback. Helper: `resolveCanonicalSiteUrl()`.
- Cursor-tavla: `apps/api/src/lib/orchestrator/workboard.json`.
- Prod-tavla: `orchestrator_cards` / `orchestrator_runs` (Drizzle).
- Puls: var 15:e minut i API:t, plus
  `POST /v1/internal/cron/orchestrator-heartbeat` med `INTERNAL_CRON_TOKEN`.
- Admin-yta: `/portal/agenten`, bara INTERNAL_ADMIN. Ringen med Agent1–16, fem sådda bord (Förening, Orderliv, Pengar, Mejl, Drift). Chatten går via samma OpenAI-nyckel som portalchatten när `AI_ENABLED` är på. Mallar om nyckeln saknas. Godkända När→gör-regler lägger kort (mejlutkast, Fortnox-utkast). PAID/Fortnox-skick/deploy/mejlpaus körs aldrig från ringen.
