---
name: roots-feedback-06-campaign-execution
description: >-
  Plan för "Genomförande" (slide 6), "Avslut & Förstärkning" (slide 7) och
  "Leverans & Logistik" (slide 8) — live tracking, gamification, "Månadens
  lirare", färdigt content för delning och packlistor. Åtta read-only sub-
  agents producerar var sin .txt-plan i docs/feedback-plans/06-campaign-
  execution/. Använd när användaren vill kartlägga drift och genomförande
  av en aktiv kampanj.
---

# Roots Feedback 06 — Kampanj-execution & gamification

## Syfte

När en kampanj är `Active` ska Roots-systemet ge:

- **Energi & driv** under perioden (live tracking, push, motivation)
- **Maxad känsla vid avslut** (topplistor, content till delning, "vill köra igen")
- **Smidig leverans** (lagvis/individvis packning, avprickningslistor)

PPT-slides 6, 7, 8.

Befintliga `campaigns`, `customer_orders`, `payouts`, `subscriptions` ska
återanvändas. Mycket av "live tracking" finns i grov form i
`/portal/page.tsx` men behöver helhetsbild.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/06-campaign-execution/`.

## Källdokument

- `public/Feedback_14:5/Säljprocess.pptx` (slides 6, 7, 8, 10)
- `apps/api/src/routes/portal.ts` (campaign-progress)
- `apps/api/src/routes/sharing.ts`
- `apps/api/src/routes/settlement.ts`
- `packages/db/src/schema/campaigns.ts`, `customer-orders.ts`, `payouts.ts`,
  `sellers.ts`, `teams.ts`
- `apps/web/src/app/(portal)/portal/page.tsx`
- `apps/web/src/app/(shop)/shop/[slug]/`
- `docs/flow-audits/SELLER_2026-04-18_1245.txt`
- `docs/flow-audits/SUPPORTER_2026-04-18_1247.txt`
- `docs/flow-audits/CONVERSION_TRUST_2026-04-18_1313.txt`

## Arbetssätt

8 sub-agents parallellt. Output i `docs/feedback-plans/06-campaign-execution/`:

```
01_live_tracking_dashboard.txt
02_gamification_levels.txt
03_push_notifications.txt
04_leaderboards_and_pride.txt
05_closing_celebration.txt
06_share_content_generator.txt
07_logistics_packing.txt
08_repeat_business_loop.txt
```

---

## De 8 sub-agents

### Agent 1 — Live tracking-dashboard (klubb / lag / individ)

**Scope:** `apps/web/src/app/(portal)/portal/`, `customer_orders`-aggregat
**Leverans:** `01_live_tracking_dashboard.txt`

Beskriv (slide 6):
- Tre vyer hierarkiskt: Klubb (förening) / Lag (group_unit) / Individ (seller)
- Mätetal per nivå: sålda paket, intäkt, % till mål, antal sålda idag, trend (7d)
- Realtid via SSE eller 30s-polling (välj ett, motivera)
- Cache-strategi (Redis 30s) för att inte tunga DB
- Drill-down: klicka klubb → se lag → se säljare
- Mobile-prioriterad design
- Befintlig `/portal/page.tsx` om CLUB_ADMIN finns — utöka, inte ersätt

### Agent 2 — Gamification-nivåer & milstolpar

**Scope:** `packages/db/src/schema/`, `apps/api/src/lib/milestones.ts` (finns)
**Leverans:** `02_gamification_levels.txt`

Beskriv:
- Audit av befintlig `milestones.ts` — vad finns idag
- Standardmilstolpar per kampanj (kan overrides per förening): 10/25/50/100/250
  paket per säljare
- Lag-milstolpar: 100/500/1000/2500
- Klubb-milstolpar: 500/2000/5000/10000
- Tabell `milestone_definitions` (additivt) + `milestone_achievements`
- Visuell presentation: badges, progress bars
- Etiskt: minderåriga säljare ska kunna stänga av synlighet (skill 03 +
  schema från MASTER_PLAN: `sellers.hide_from_leaderboard` finns redan)
- "Spelare" → "den som vill sälja" (master plan-feedback om språk)

### Agent 3 — Push-notiser

**Scope:** Email + ev. webpush, `apps/api/src/lib/email/`, ny notifications-modul
**Leverans:** `03_push_notifications.txt`

Beskriv (slide 6 — "Pushar"):
- Trigger-events: 50% till mål, 75%, 90%, sista veckan, sista dagen
- Trigger per nivå (säljare / lag / klubb)
- Kanaler: e-post (Resend, finns), webpush (PWA service worker), SMS-deep-link
- Mall-system (ersätter ad-hoc) — placeholder-engine
- Anti-spam: max 1 push/dygn per säljare som default, ASM kan justera
- Opt-out per säljare (GDPR)
- Mätning: open rate, click rate, retention

### Agent 4 — Leaderboards & FOMO mellan föreningar

**Scope:** Ny vy `/portal/leaderboard`, opt-in mellan klubbar
**Leverans:** `04_leaderboards_and_pride.txt`

Beskriv (slide 6 + slide 10 punkt 3):
- Inom klubb: säljar-leaderboard + lag-leaderboard
- Mellan klubbar: opt-in regional ranking ("Andra Onsala-föreningar")
- Anonymisering på individ-nivå mellan klubbar (visa bara klubbnamn + total)
- Filter: senaste 7d / hela kampanjen / all-time
- Animationer (motion.dev finns ev.) på position-skifte
- "Ni är 72% till mål, lag X leder" — kompiosition från denna data
- Etisk: hänsyn till `sellers.hideFromLeaderboard`, minderåriga, skyddad
  identitet

### Agent 5 — Closing celebration & "Månadens lirare"

**Scope:** Settlement-flöde, ny vy `/portal/celebration/<campaign_id>`
**Leverans:** `05_closing_celebration.txt`

Beskriv (slide 7):
- Auto-genererad celebration-sida när kampanj går från Active → Ended
- Total intäkt klubb/lag/individ
- Top 3 säljare med tillstånd
- "Månadens lirare" (per kampanj eller per månad)
- Diplom (PDF, downloadable)
- Animation/confetti
- Trigger e-post till alla deltagare med länk
- Sparas permanent (även efter ny kampanj)

### Agent 6 — Share-content-generator

**Scope:** Ny `/portal/share-kit/<campaign_id>`, integration med ev. canvas/Remotion
**Leverans:** `06_share_content_generator.txt`

Beskriv (slide 7 — "Vi drog in 87 000 kr"):
- Auto-genererade bilder/videos klara att posta:
  Mall A: "Onsala BK drog in 87 000 kr — tack alla supportrar!"
  Mall B: "Vinnar-laget P10 Svart, 12 700 kr"
  Mall C: "Topp 3 säljare denna kampanj"
- Format: Instagram (1:1), Stories (9:16), Facebook (1.91:1)
- Använd Remotion (finns enligt skills) eller HTML/Canvas → PNG
- One-click "Kopiera bildtext" + suggested hashtags
- Branding: Roots-logga + förenings-logga
- GDPR: ALDRIG visa enskild säljares namn utan samtycke

### Agent 7 — Leverans & logistik (packlistor)

**Scope:** `customer_orders.ts` + ny export-funktionalitet
**Leverans:** `07_logistics_packing.txt`

Beskriv (slide 8 — "moment of truth"):
- "Pack lista" PDF/Excel per kampanj med två lägen:
  Lagvis (default): grupperat per group_unit, en sida per lag
  Individvis: en rad per kund med säljare + lag-tag
- Avprickningslista (printable, kollumner: kund, leveransadress, paket,
  signatur)
- Tydliga instruktioner-kort som följer med paketen
- Kommunikationsplan: 3–5 dagar innan leverans skickas auto-mejl ("Så här
  går det till")
- Status-flow: Confirmed → Packed → Delivered (finns delvis), webhook till
  Klarna/Fortnox
- Audit-trail per paket (vem prickade av, när)
- Mobile-app eller PWA för avprickning under leveransdagen

### Agent 8 — Repeat business loop & prenumeration

**Scope:** `subscriptions.ts`, post-settlement-flöde
**Leverans:** `08_repeat_business_loop.txt`

Beskriv (slide 7 + slide 10 punkt 4):
- Auto-uppgift till ASM 30 dagar efter settled: "Boka in nästa säljperiod med
  X klubb"
- Föreningens superuser ser CTA: "Vill ni köra igen i höst?"
- Snabbreplikat-kampanj (kopia av föregående, justerade datum)
- Prenumerationsspår: enskilda kunder kan välja "skicka var 3:e månad"
  (finns delvis i `subscriptions`)
- Föreningsprenumeration (kvartalsvis kampanj)
- LTV/retention-rapport per klubb
- Rabattmekanik för retur-kampanjer (5% bonus på marknadsstöd)

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/06-campaign-execution/`. Markera
beroenden till skill 03 (groups for leaderboard), skill 04 (AI för
content-generering), skill 05 (Stängning & Setup-wizard).

## Checklista

- [ ] 8 .txt-filer
- [ ] Befintliga `milestones.ts`/`subscriptions.ts` återanvänds
- [ ] Etiska gränser kring minderåriga + leaderboards adresserade
