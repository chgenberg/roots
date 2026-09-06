---
name: orchestrator
description: >-
  Roots project OS. Use on every non-trivial prompt: boot memory and
  workboard, route across domains, claim a card, respect approval gates.
  Read the graph before editing flows that span more than one surface.
---

# Agenten — Roots OS

Grafen i `apps/api/src/lib/orchestrator/graph.ts` är sanningen. Workboard:
`apps/api/src/lib/orchestrator/workboard.json`. Soul:
`.cursor/orchestrator/SOUL.md`. Husark: `docs/agent-os/ADAPT.md`.

Användarvänd text säger **agenten**, aldrig AI, för det här OS:et.

## Boot (gör så här i början av turen)

1. Läs `.cursor/orchestrator/MEMORY.md`.
2. Läs `memory/YYYY-MM-DD.md` för idag och igår.
3. Läs `apps/api/src/lib/orchestrator/workboard.json`.
4. Route mot `DomainId` / playbook i grafen.
5. Finns ett öppet kort? Claima det (`doing`). Annars skapa ett med
   `domainId`, `files` och rätt `gate`
   (`none | deploy | irreversible | email | money`).
6. Om `canExecute` i `apps/api/src/lib/orchestrator/approvals.ts` säger
   nej: stanna och visa grindens `reason`. Kör inte irreversible, deploy
   eller mejl.

## Workboard (under turen)

1. **Route.** Välj ett eller flera `DomainId`.
2. **Läs kanterna**, inte bara nodens filer.
3. **Specialist.** Öppna den Cursor-regel som hör till kanten.
4. **Kirugi.** Ändra det prompten bad om. Skriv inte om grannflödet.
5. **Kolla grannarna** vid status, pris, utbetalning eller mejl.

## Slut på turen

1. Append en rad i `.cursor/orchestrator/memory/YYYY-MM-DD.md`.
2. Flytta kortet (`done` / `blocked` / `ready`).
3. Skriv till `MEMORY.md` bara om faktat håller över veckor. Aldrig
   hemligheter.
4. Längre session som ändrade hur vi jobbar → en paragraf i `DREAMS.md`.

## Heartbeat

Checklista: `.cursor/orchestrator/HEARTBEAT.md`. I Cursor: `/loop` mot
den filen. I prod: `POST /v1/internal/cron/orchestrator-heartbeat`
skapar kort och kör säkra Hands. Kör aldrig irreversible, deploy eller
lyft av mejlpaus.

## Routing (prompt → domän → läs först)

| Om prompten rör | Domän | Läs först |
|---|---|---|
| Publik yta, startsida, föreningsliv | `public` | `apps/web/src/app/(marketing)/page.tsx` |
| Login, session, roll, preview-gate | `auth` | `apps/api/src/routes/auth.ts` |
| Produkter, kassa, Stripe | `shop` | `apps/api/src/routes/shop.ts`, `checkout.ts` |
| Förening, lag, min-shop, kampanj | `fundraising` | `apps/api/src/routes/dashboard.ts` |
| Klubbportal, pipeline, sälj | `portal` | `apps/api/src/routes/portal.ts` |
| Admin, OS, tavla, granskning | `admin` | `apps/api/src/lib/orchestrator/*` |
| Utskick, `FEATURE_EMAIL_DISABLED` | `email` | `apps/api/src/lib/email/index.ts` |
| 35 %, utbetalning, Fortnox, Stripe | `money` | `apps/api/src/routes/payouts.ts` |

## När du är osäker

Öppna `graph.ts`. Gissa inte en ny arkitektur.
