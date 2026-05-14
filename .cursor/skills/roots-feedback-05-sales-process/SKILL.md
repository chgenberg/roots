---
name: roots-feedback-05-sales-process
description: >-
  Plan för att digitalisera Säljprocess.pptx (7-stegs flöde: Lead-prio,
  Bokning/Motorn, Säljmöte med räknesnurra, Stängning/Setup, Genomförande,
  Avslut, Leverans). Åtta read-only sub-agents producerar var sin .txt-plan
  i docs/feedback-plans/05-sales-process/. Använd när användaren vill
  kartlägga säljarens portal-verktygslåda.
---

# Roots Feedback 05 — Säljprocess-toolkit

## Syfte

`Säljprocess.pptx` definierar 7 steg för en repeterbar, högkvalitativ
säljprocess. Roots-portalen ska bli ASM:ens/säljarens **playbook +
verktygslåda**:

1. Lead → Prioritering (A/B/C, potentialmatris)
2. Bokning + identifiering av "Motorn" (handlingskraftig kontakt)
3. Säljmöte (räknesnurra, marknadsstöd-trigger)
4. Stängning & Setup (superuser, period, leverans, struktur, mål)
5. Genomförande (live tracking, gamification, push)
6. Avslut & Förstärkning (topplista, content, boka nästa)
7. Leverans & Logistik (lagvis/individvis, avprickning, kommunikation)

Plus PPT-slide 9–10 ("Att fundera över"): incitament för Motorn, säljarens
playbook, pilot-mode, FOMO mellan föreningar, prenumeration.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/05-sales-process/`.

## Källdokument

- `public/Feedback_14:5/Säljprocess.pptx` (alla 10 slides)
- `public/Feedback_14:5/Modell_register.docx` (för `lead_source`, ASM-roll, status)
- `apps/api/src/routes/portal.ts`
- `apps/web/src/app/(portal)/portal/saljare/page.tsx`
- `apps/web/src/app/(portal)/portal/page.tsx`
- `docs/flow-audits/SALES_REP_2026-04-18_1252.txt`
- `docs/flow-audits/ASSOCIATION_ONBOARDING_2026-04-18_1241.txt`
- `docs/flow-audits/MASTER_PLAN_2026-04-18.md`

## Arbetssätt

8 sub-agents parallellt. Output i `docs/feedback-plans/05-sales-process/`:

```
01_lead_prioritization.txt
02_motor_identification.txt
03_revenue_calculator.txt
04_marketing_support_trigger.txt
05_close_and_setup_wizard.txt
06_seller_playbook.txt
07_objection_library.txt
08_pilot_mode_and_subscription.txt
```

---

## De 8 sub-agents

### Agent 1 — Lead-prioritering & potentialmatris

**Scope:** `apps/web/src/app/(portal)/portal/`, ny vy
**Leverans:** `01_lead_prioritization.txt`

Beskriv (slide 2):
- Vy `/portal/leads/prioritera`
- ABC-bucketing (A = >0.8 potential, B = 0.5–0.8, C = <0.5)
- Inputs som visas per lead: storlek (estimated_members), historik (Folkspel/
  Newbody-tagg), struktur (förening vs lös), kännedom/relation
- Output per lead: "Hypotes: Den här klubben borde kunna sälja 1500–2000 paket"
  — där siffran kommer från `potential_score` × segmentnorm
- Sortering, filter, snabbåtgärd "boka möte"
- Kopplar till skill 02 agent 5 (pipeline)

### Agent 2 — Identifiera "Motorn"

**Scope:** Ny tabell `organization_contacts`, UI för bokningsmöte
**Leverans:** `02_motor_identification.txt`

Beskriv (slide 3 + slide 9):
- Ny tabell `organization_contacts`:
  id, organization_id, name, role (ordförande/kassör/lagledare/ungdomsansvarig
  /Motor), phone, email, is_motor BOOL, social_capital_score (1–5),
  notes, created_at
- Checklista i UI för att markera Motorn ("handlingskraftig?", "respekt i
  gruppen?", "gillar att få saker att hända?")
- "Du känns som rätt person att driva detta"-coaching-text
- Incitamentstrukturpålogg: titel i appen ("Roots Captain"), bonus-mall
  (slide 9 punkt 1)
- Synkning med `users` om Motorn senare blir TEAM_LEADER (samma personrad)

### Agent 3 — Räknesnurran (Revenue Calculator)

**Scope:** Nytt API-endpoint + UI-komponent + AI-tool (skill 04 agent 6)
**Leverans:** `03_revenue_calculator.txt`

Beskriv (slide 4 — "vår killer 🔥"):
- Komponent `<RevenueCalculator />` som visar live-uträkning
- Två ingångar: per-medlem (paket × medlemmar) och per-lag (paket × lag)
- "Vad tror du är rimligt per spelare?" — säljaren skriver in DEM:s siffra
- Visualisering: stapeldiagram + nettotal + förenings-andel + säljar-andel
- Spara snapshot per möte (`meeting_calculations`-tabell) för uppföljning
- Använd som standalone-flik på `/portal/saljare/<id>` ELLER inbäddad i
  möte-formulär
- Mobile-vänlig (säljaren visar på telefon i möte)
- Aldrig garantera utfall (befintlig guardrail)

### Agent 4 — Marknadsstöd-trigger (Bonus-trappa)

**Scope:** Ny modell `marketing_support_tiers`, UI i räknesnurran
**Leverans:** `04_marketing_support_trigger.txt`

Beskriv (slide 4 sista delen):
- Tabell `marketing_support_tiers`: id, campaign_id (eller global), name,
  threshold_packages, bonus_amount_ore, description, sort_order
- Standardpaket: "Bas (X kr vid Y försäljning)", "Bonus (mer vid högre nivå)"
- Visualisering: trappor med "Ni är 73% till nästa nivå"
- Trigger-event: när tröskel passeras → notifiering till förening + säljare,
  ev. social media-content auto-genereras (skill 06)
- Manage-UI för INTERNAL_ADMIN (sätta trösklar centralt)
- Bakåtkompatibilitet: globala defaults + per-kampanj override

### Agent 5 — Stängning & Setup-wizard

**Scope:** Ny route `/portal/setup-campaign`, ersätter ad-hoc onboarding
**Leverans:** `05_close_and_setup_wizard.txt`

Beskriv (slide 5):
- Multi-steg-wizard som ASM kan köra IGENOM med kunden i mötet:
  Steg 1: Superuser/ansvarig (sökning bland organization_contacts → välj
  Motorn → konvertera till TEAM_LEADER om inte redan)
  Steg 2: Säljperiod (start/slut datepickers)
  Steg 3: Leveransdatum + plats
  Steg 4: Riksorganisation, sport, lag/ålder, skola (auto-ifyllt från
  organization)
  Steg 5: Struktur — bulk-create grupper (skill 03 agent 4)
  Steg 6: Mål — per medlem / per lag / total klubb
  Steg 7: Granska & aktivera (org.status = Active, campaign.status = Active)
- Auto-trigga inbjudningar till Motorn + lagledare
- Spara draft mellan steg (registration_drafts-tabell, redan i master plan)
- Kopplar till skill 03 (group_unit) och skill 02 (status-transition)

### Agent 6 — Säljarens playbook (intern)

**Scope:** Ny sida `/portal/playbook`, MDX-baserat innehåll
**Leverans:** `06_seller_playbook.txt`

Beskriv (slide 9 punkt 2):
- Sida `/portal/playbook` med navbar: Mötesstruktur / Frågor / Räknesnurran /
  Invändningar / Cases
- Innehållet i Markdown/MDX i repo (`apps/web/src/content/playbook/`)
- Sökbar
- Versionerad (Git)
- "Senast uppdaterad" + ägare per artikel
- TILLGÄNGLIGT FÖR: SALES_REP, SALES_ADMIN, ASM, INTERNAL_ADMIN
- Spelplan vid kickoff: ASM gör "Mock-möte" med superuser via playbook

### Agent 7 — Invändningsbibliotek

**Scope:** Tabell `objections` + AI-coach (skill 04 agent 6)
**Leverans:** `07_objection_library.txt`

Beskriv:
- Tabell `objections`: id, category (Tid/Pengar/Konkurrent/Risk), invändning
  (text), recommended_response (text), examples_jsonb, score (votes), tags
- Sida `/portal/playbook/invandningar` med filter och röst-knappar
- AI-coach kan citera direkt i chatten (skill 04 agent 6)
- Säljare kan rapportera ny invändning → kö för INTERNAL_ADMIN att redigera
  och publicera
- "5 vanligaste denna vecka" på dashboard

### Agent 8 — Pilot-mode + Återköp/Prenumeration

**Scope:** `campaigns.ts` schema, `subscriptions.ts` (finns), settlement
**Leverans:** `08_pilot_mode_and_subscription.txt`

Beskriv (slide 10):
- Pilot-mode: vid första kampanj kan ASM markera `campaign.is_pilot = true`,
  vilket: sänker mål-tröskeln, döljer leaderboard mellan klubbar, ger extra
  marknadsstöd-instruktioner, lägger upp "kickoff-möte fysiskt"-uppgift
- "Vill ni köra igen?"-uppföljning: 30 dagar efter `campaign.status = SETTLED`
  ⇒ auto-uppgift till ASM
- "Eller prenumerationsspår?" — koppla till befintliga `subscriptions`-tabell
- FOMO-mekanik: ranking mellan klubbar (opt-in, ingen sharing av personnamn —
  bara klubbnamn + total)
- Upsell-content färdigt att kopiera: "Andra föreningar i ert distrikt drar in X kr"
- Etisk gräns: aldrig pressa minderåriga säljare med rankings

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/05-sales-process/`. Markera
explicita kopplingar till skill 02 (CRM-status), skill 03 (groups), skill 04
(AI-tool), skill 06 (gamification).

## Checklista

- [ ] 8 .txt-filer
- [ ] Varje agent refererar tillbaka till specifik slide i Säljprocess.pptx
- [ ] Bakåtkompatibilitet med befintliga `campaigns`/`teams`/`sellers`
