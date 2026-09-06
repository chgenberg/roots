# Anpassa Agent-OS till Roots

Projekt: Roots (roots.nu)
Datum: 2026-09-06

---

## 1. Röst

Vad kallas kollegan i användarvänd text?

- [x] agenten (rekommenderat)

Ord som aldrig får synas utåt: AI, modellnamn, “assistenten” som kodnamn för OS:et.

Befintlig chatt på `/portal/ai` är en annan yta. Den kallas AI-assistent där den redan gör det. OS:et heter **agenten**.

---

## 2. Domäner (8)

| DomainId | Lager | En mening | Läs först |
|---|---|---|---|
| public | ingress | Det besökaren ser utan konto. | `apps/web/src/app/(marketing)/page.tsx` |
| auth | ingress | Session, roll, CSRF, preview-gate. | `apps/api/src/routes/auth.ts` |
| shop | spine | Produkter, kassa, Stripe. | `apps/api/src/routes/shop.ts`, `checkout.ts` |
| fundraising | roles | Förening, lag, min-shop. | `apps/api/src/routes/dashboard.ts` |
| portal | roles | Klubb- och säljardashboard. | `apps/api/src/routes/portal.ts` |
| admin | roles | Intern admin, OS-tavla, grindar. | `apps/api/src/lib/orchestrator/graph.ts` |
| email | outbound | Transaktionsmejl. Respektera paus. | `apps/api/src/lib/email/index.ts` |
| money | outbound | 35 % klubb, Stripe, utbetalning, Fortnox. | `apps/api/src/routes/payouts.ts` |

Kanter som är verkliga flöden:

1. public → auth (logga in)
2. public → shop (köp schampoo)
3. auth → fundraising (förening / lag / säljare)
4. auth → portal (klubb / sälj)
5. auth → admin (INTERNAL_ADMIN)
6. fundraising → email (inbjudan, påminnelse)
7. fundraising → money (kampanjintäkt, 35 %)
8. shop → money (Stripe / kassa)
9. admin → email (utskick, larm)
10. admin → money (utbetalningskö — never-knapp)

Playbooks:

1. `supporter-buy` — besökare köper via shop
2. `club-campaign` — förening startar försäljning
3. `payout` — utbetalning till lag (irreversible)

---

## 3. Never-knapp → grind `irreversible`

Namn i UI: Markera utbetald / skicka Fortnox-faktura / banköverföring
System: Fortnox + manuell bank + `PATCH /v1/payouts/:id/status`
Varför: Pengar som lämnat Roots kan inte tas tillbaka av automation.

---

## 4. Mejl

Kill-switch env: `FEATURE_EMAIL_DISABLED=true`

Vem får lyfta den: människa i Railway / `.env`. Aldrig en Hand.

Transaktionsmejl som får gå på `none` om idempotent och paus respekteras:

- [x] Orderbekräftelse
- [x] Inbjudan till säljare / lag
- [x] Återställ lösenord

Utskick som kräver `email` + ja:

- [x] Outreach, nyhetsbrev, påminnelsekampanj

---

## 5. Pengar

Vad är `money` här? Klubbens 35 %, Stripe-kassa, utbetalningskö, Fortnox-faktura.

Tak som pulsen ska vakta: inget spend-tak än. Pulsen räknar väntande utbetalningar, sätter inte pris.

---

## 6. Deploy

Hur ser “ren genomgång” ut i det här repot?

Skill / kommando: `.cursor/skills` bug-hunter / `qc-bug-hunter-prepush` (och syskon).
Vad räknas som blocker: CRITICAL eller HIGH.
Vem säger ja: människa. Push till `main` deployar webben på Railway — därför är deploy en grind även när koden redan är skriven.

---

## 7. Heartbeat (5 rader)

| # | Villkor | Nyckel | DomainId | Gate | Hand? | Cap/tick |
|---|---|---|---|---|---|---|
| 1 | `FEATURE_EMAIL_DISABLED=true` | `email-paused` | email | email | nej | — |
| 2 | Utbetalningar med status PENDING | `pending-payouts` | money | money | nej | — |
| 3 | Schemalagt jobb tyst (deletion-purge, lead-retention, orchestrator-heartbeat) | `stale-job:<name>` | admin | none | nej | — |
| 4 | Föreningar med `verified=false` | `pending-org-review` | admin | none | nej | — |
| 5 | Workboard-blockers med grind deploy / irreversible / money | lämna | — | — | nej | — |

Aldrig på ett tick: deploy, irreversible, lyfta mejlpaus, sätta pris, outreach.

---

## 8. Fas

- [x] Fas 1: Cursor + JSON-tavla
- [x] Fas 2: Drizzle + cron + admin

Cron-secret env: `INTERNAL_CRON_TOKEN` (befintlig, inte ett nytt namn)
Schema: var 15:e minut i API-processen, plus `POST /v1/internal/cron/orchestrator-heartbeat`
