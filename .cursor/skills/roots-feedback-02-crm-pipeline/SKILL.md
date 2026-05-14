---
name: roots-feedback-02-crm-pipeline
description: >-
  Plan för att omvandla Roots från "webshop med roller" till en CRM- och
  relationsplattform med tydlig lead-pipeline (Lead → Customer), ASM-roll,
  potential_score och lead_source. Åtta read-only sub-agents producerar var sin
  .txt-plan i docs/feedback-plans/02-crm-pipeline/. Använd när användaren vill
  kartlägga CRM-omstöpningen från Modell_register-feedbacken.
---

# Roots Feedback 02 — CRM & Pipeline-redesign

## Syfte

Modell_register-feedbacken är tydlig: "Bygg det som CRM med eCommerce ovanpå —
inte tvärtom." Det innebär:

- En riktig **lead-pipeline** med statusarna `Lead → Contacted → Meeting →
  Active → Customer → Inactive → Lost`
- En ny intern roll **ASM** (Area Sales Manager / fältsäljare) som äger
  organisationer
- `lead_source`, `potential_score`, `assigned_asm` på organisations-nivå
- Aktivitetslogg per organisation (möten, samtal, mejl) för att stötta säljarna

Befintliga `quotes`/`pipeline`-byggen ska återanvändas där de passar, inte
rivas.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/02-crm-pipeline/`.

## När den används

- Användaren ber om "skill 02", "CRM-plan", "pipeline-omstöpning"
- Förberedelse inför att utvecklaren ska bygga lead-modell + ASM-flöde

## Källdokument

- `public/Feedback_14:5/Modell_register.docx` (kap 6, 12, 13)
- `public/Feedback_14:5/Säljprocess.pptx` (slide 2 — "Lead → Prioritering")
- `apps/api/src/routes/portal.ts` (befintlig pipeline-endpoint)
- `packages/db/src/schema/quotes.ts`
- `packages/db/src/schema/leads.ts`
- `packages/db/src/schema/users.ts` (för ny roll)
- `apps/web/src/app/(portal)/portal/page.tsx` (sales dashboard)
- `apps/web/src/app/(portal)/portal/saljare/page.tsx`
- `docs/flow-audits/SALES_REP_2026-04-18_1252.txt`
- `docs/flow-audits/MASTER_PLAN_2026-04-18.md`

## Arbetssätt

Använd Task med `subagent_type: "explore"` + `readonly: true`. Skicka alla 8
i ett meddelande.

Spara 8 .txt-filer i `docs/feedback-plans/02-crm-pipeline/`:

```
01_lead_status_model.txt
02_asm_role.txt
03_lead_source_potential.txt
04_activity_log.txt
05_pipeline_view.txt
06_quote_to_customer_journey.txt
07_assignment_routing.txt
08_existing_quote_migration.txt
```

---

## De 8 sub-agents

### Agent 1 — Lead/status-modellen

**Scope:** `packages/db/src/schema/`, alla queries mot `organizations.status`
**Leverans:** `01_lead_status_model.txt`

Beskriv:
- ENUM `org_status`: Lead/Contacted/Meeting/Active/Customer/Inactive/Lost
- Övergångsregler (vilka transitions är tillåtna, vem får göra dem)
- `status_changed_at`, `status_changed_by`, `next_action_at` kolumner
- Relation till befintlig `campaigns.status` — INTE samma sak (campaigns ägs av
  Active/Customer-organisationer)
- Audit-log integration (`campaign.status.changed` finns redan, lägg till
  `org.status.changed`)
- Kanban-vy vs lista — vilka behov per roll

### Agent 2 — Ny roll: ASM (Area Sales Manager)

**Scope:** `packages/db/src/schema/users.ts`, `apps/web/src/middleware.ts`,
RBAC-checkar i API-routes
**Leverans:** `02_asm_role.txt`

Beskriv:
- Tillägg `ASM` i `roleEnum` — additivt, ingen befintlig roll byts
- Skillnad mellan `ASM` och `SALES_REP` (ASM = territoryägare, SALES_REP =
  inside sales / mer transaktionellt)
- ASM:s territory: geografi (region/municipality) + segment
- `users.territory` JSONB eller separat `asm_territories`-tabell?
- RBAC-matris: vilka /portal/-sidor får ASM se, vilka organisationer i sin
  territory
- Synergi med befintliga `SALES_ADMIN` och `INTERNAL_ADMIN`
- Inviteringsflöde för en ny ASM-användare

### Agent 3 — `lead_source` och `potential_score`

**Scope:** `packages/db/src/schema/organizations.ts`, AI-kalkyleringen
**Leverans:** `03_lead_source_potential.txt`

Beskriv:
- ENUM `lead_source`: Cold Outreach/Referral/Digital/Event/Partner/ASM Network/Existing Customer
- Var sätts `lead_source` (på create eller manuellt senare)
- `potential_score` formel-skiss: f(estimated_members, segment.avg_per_member,
  status_history, asm_input). Hänvisa till skill 04 för AI-agenten.
- `tags` (text[]) för fri etikettering ("varm", "stort intresse", etc.)
- UI-fält i org-create + org-edit + org-list-filter

### Agent 4 — Aktivitetslogg per organisation

**Scope:** `packages/db/src/schema/`, finns ev. som notes? (kolla)
**Leverans:** `04_activity_log.txt`

Beskriv ny tabell `organization_activities`:
- id, organization_id FK, user_id FK (vem loggade), type (call/meeting/email/note/quote_sent/won/lost/follow_up), happened_at, summary text, payload JSONB
- Index på (organization_id, happened_at desc)
- API: `GET/POST /v1/organizations/:id/activities`
- UI: timeline-komponent på org-detalj-sida
- Auto-skapade aktiviteter (när status byts, när offert skickas, när kampanj startar)
- Relation till befintliga `audit_logs` — aktivitetslogg är USER-facing,
  audit_logs är system-facing. Sammanfoga inte.
- Påminnelse-system (`next_action_at` + e-post)

### Agent 5 — Pipeline-vy (Kanban + tabell)

**Scope:** `apps/web/src/app/(portal)/portal/page.tsx`, `/portal/saljare/`
**Leverans:** `05_pipeline_view.txt`

Beskriv:
- Ny sida `/portal/pipeline` (eller utöka befintlig)
- Kanban: kolumner = status, kort = organisation, drag-and-drop
- Filter: ASM, segment, riksorg, lead_source, potential_score-bucket
- Snabbåtgärder per kort: ring (tel-länk), maila, boka möte, anteckning
- Aggregat-rad ovanför: antal/segment + förväntat värde
- Mobile fallback: lista med swipe-actions
- Hur befintliga `/portal/pipeline` (om finns) återanvänds eller ersätts

### Agent 6 — Kundresan: Quote → Active Customer

**Scope:** `packages/db/src/schema/quotes.ts`, `campaigns.ts`,
`apps/api/src/routes/portal.ts`, `checkout.ts`
**Leverans:** `06_quote_to_customer_journey.txt`

Beskriv:
- När en ASM/SALES_REP skickar offert: `org.status = Meeting → Contacted` (om
  inte redan högre)
- När offert accepteras: `org.status = Active`, kampanj skapas automatiskt,
  superuser/team_leader bjuds in (kopplar till skill 05 slide 5 "Stängning &
  Setup")
- När kampanj är settled: `org.status = Customer` (returnerande)
- När 12 mån utan aktivitet: auto till `Inactive`
- Hur befintlig `quotes`-tabell ska få `won_at`, `lost_reason` enums
- Dashboardpåverkan (MRR, conversion-rate per ASM)

### Agent 7 — Tilldelning och routing av leads

**Scope:** Ny funktionalitet, troligen ny route `/v1/leads/assign`
**Leverans:** `07_assignment_routing.txt`

Beskriv:
- Round-robin / load-balanced tilldelning av nya leads till ASM efter territory
- Re-tilldelning vid frånvaro (semester/sjuk)
- Manuell tilldelning av INTERNAL_ADMIN
- "Mine"/"All"/"Unassigned"-filter i pipeline
- Eskalation: lead som ligger i `Lead`-status > N dagar utan aktivitet
- Notifikation (e-post + portal-toast) när en ASM får ett lead tilldelat
- Audit-log för varje tilldelning

### Agent 8 — Migration från befintlig quote/pipeline

**Scope:** `apps/api/src/routes/portal.ts` (`/pipeline`, `/dashboard`),
befintliga `quotes`-rader
**Leverans:** `08_existing_quote_migration.txt`

Beskriv:
- Inventering: hur ser befintlig pipeline-endpoint ut, vad returnerar den, vilka
  UI-komponenter konsumerar den
- Backfill: härleda `org.status` från befintliga quotes (om accepted ⇒ Customer)
- Coexistence-period: gamla `quotes.status` + nya `org.status` lever parallellt,
  båda visas tills ny vy är godkänd
- Feature-flag `FEATURE_CRM_PIPELINE_V2`
- Bakåtkompatibilitet: API-svar behåller alla befintliga fält, lägger till nya
- Definition of Done för rollout (% leads med status, % orgs med ASM, etc.)

---

## Sub-agent prompt-mall

Identisk struktur som skill 01. Output-mappen är
`docs/feedback-plans/02-crm-pipeline/`. Mallen för .txt-filerna:

```
==============================================
{N}. {NAME}
==============================================

NULÄGE
VAD FEEDBACKEN SÄGER
GAP
IMPLEMENTATION
BAKÅTKOMPATIBILITET
DEPENDENCIES
TESTPLAN
RISKER
UPPSKATTAD INSATS
--- SLUT ---
```

## Checklista

- [ ] 8 .txt-filer i `docs/feedback-plans/02-crm-pipeline/`
- [ ] Inga andra ändringar
- [ ] Konkret hänvisning till befintliga `quotes` och `pipeline`-endpoints
- [ ] Cross-refs till skill 01 (masterdata) och skill 04 (AI-agenter) markerade
