---
name: roots-feedback-01-master-data
description: >-
  Bygg planen för Roots masterdata-arkitektur (Riksorganisation, Segment/Förbund,
  Organisation 2.0) baserat på Modell_register-feedbacken och Excel-mastrarna i
  public/Feedback_14:5/. Åtta read-only sub-agents producerar var sin .txt-plan
  i docs/feedback-plans/01-master-data/. Använd när användaren vill kartlägga
  vägen från nuvarande organizations-tabell till en hierarkisk masterdata-modell.
---

# Roots Feedback 01 — Masterdata-arkitektur

## Syfte

Skapa en konkret, fil-för-fil implementationsplan för att införa masterdata-
hierarkin från `Modell_register.docx`:

```
Riksorganisation → Segment/Förbund → Organisation → Grupp/Lag/Klass
```

Excel-filerna `roots_master_riksorganisationer.xlsx` (~100 rader) och
`roots_segment_master_rekommenderad.xlsx` (~110 rader) är färdiga seed-data.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/01-master-data/`. Inga kod-, schema- eller config-ändringar.

## När den används

- Användaren ber om "fas 1", "masterdata-plan", "skill 01", eller hänvisar till
  Riksorganisation/Segment-mastrarna
- Förberedelse inför att utvecklaren ska bygga `master_riksorganisation`,
  `master_segment` och uppgradera `organizations`-tabellen

## Källdokument (sub-agents MÅSTE läsa)

- `public/Feedback_14:5/Modell_register.docx` (kap 4–6, 13)
- `public/Feedback_14:5/roots_master_riksorganisationer.xlsx`
- `public/Feedback_14:5/roots_segment_master_rekommenderad.xlsx`
- `packages/db/src/schema/organizations.ts` (nuvarande modell)
- `packages/db/src/schema/users.ts`, `teams.ts`, `sellers.ts`
- `packages/db/drizzle/0000_premium_photon.sql`
- `docs/flow-audits/MASTER_PLAN_2026-04-18.md` (för att inte krocka)

## Arbetssätt

### Steg 1 — Starta 8 sub-agents parallellt

Använd Task-tool med `subagent_type: "explore"` och `readonly: true`. Skicka
alla 8 i **ett enda meddelande** så de körs samtidigt.

### Steg 2 — Skriv 8 .txt-filer

När alla agents returnerat, spara varje agents output som EGEN fil i
`docs/feedback-plans/01-master-data/`:

```
01_riksorganisation_table.txt
02_segment_table.txt
03_organization_upgrade.txt
04_seed_import.txt
05_normalization_rules.txt
06_search_autocomplete.txt
07_admin_ui.txt
08_migration_strategy.txt
```

Skapa katalogen om den inte finns. Skriv INGET annat.

---

## De 8 sub-agents

### Agent 1 — `master_riksorganisation`-tabellen

**Scope:** `packages/db/src/schema/`, Excel-filen riksorganisationer
**Leverans:** `01_riksorganisation_table.txt`

Beskriv:
- Drizzle-schema (id UUID, name unique, code unique, type, active, sort_order, created_at)
- Index och constraints
- Hur tabellen seedas från Excel (script, vilka kolumner mappas)
- Förhållande till befintlig `organizations.type`-kolumn ('club','team','association')
- Om FK från `organizations.riksorganisation_id` ska vara NOT NULL eller NULL i v1

### Agent 2 — `master_segment`-tabellen

**Scope:** `packages/db/src/schema/`, Excel-filen segment
**Leverans:** `02_segment_table.txt`

Beskriv:
- Drizzle-schema (id, riksorganisation_id FK, name, code, type, active)
- Composite unique (riksorganisation_id, name) eller separat code
- Seed-strategi (110 rader, joinas mot riksorg via name)
- Hur "Typ"-kolumnen (Idrott, Friluftsliv, Skola/Ungdom, Musik/Kultur, etc.)
  ska standardiseras till en enum eller dropdown-lista
- Hierarki — kan ett segment tillhöra flera riksorganisationer? (svar: nej i v1)

### Agent 3 — Uppgradering av `organizations`

**Scope:** `packages/db/src/schema/organizations.ts`, alla queries som
använder `organizations`
**Leverans:** `03_organization_upgrade.txt`

Beskriv tilläggen från Modell_register kap 6:
- `display_name` (autocomplete) vs `normalized_name` (hidden)
- `riksorganisation_id` FK
- `segment_id` FK
- `organization_type` ENUM (Association/School/Class/Team/Scout/Company/Other)
  — krockar med befintliga 'club'/'team'/'association'? Mappingstabell.
- `municipality`, `region`, `postal_code`, `website`
- `status` ENUM (Lead/Contacted/Meeting/Active/Customer/Inactive/Lost)
- `assigned_asm` FK till users
- `lead_source` ENUM (Cold Outreach/Referral/Digital/Event/Partner/ASM Network/Existing Customer)
- `potential_score` int (hidden, AI-räknad)
- Vilka befintliga kolumner som ska behållas/deprecieras
- Konkret ALTER TABLE migration-skiss (additiv, NOT NULL DEFAULT)

### Agent 4 — Seed-import för Excel-mastrarna

**Scope:** `packages/db/src/seed.ts`, `packages/db/scripts/`
**Leverans:** `04_seed_import.txt`

Beskriv:
- Exakt skript-struktur (Node script som läser .xlsx via `xlsx`-paketet eller
  förgenererad CSV/JSON i repo)
- Idempotent upsert-strategi (ON CONFLICT DO NOTHING på code/name)
- Var i monorepot Excel/CSV-filerna ska läggas (`packages/db/data/master/`)
- Hur seed:en triggas vid `pnpm db:seed` och i CI
- Vad som händer om en rad i master raderas i framtiden — soft delete?

### Agent 5 — Normaliseringsregler (Visningsdata vs Analysdata)

**Scope:** Modell_register kap 3, 7, 13; Hela datamodellen
**Leverans:** `05_normalization_rules.txt`

Beskriv den övergripande PRINCIPEN:
- Vilka fält är VISNINGSDATA (display_name, kommentarer, anteckningar)
- Vilka fält är ANALYSDATA (alla enums, FKs, birth_year, age_band)
- Naming convention: `display_name` vs `normalized_name`, `code` vs `name`
- Trigger/computed-strategi för `normalized_name` (SQL-funktion eller app-side)
- Hur denna princip ska genomsyra ALLA framtida tabeller (group_unit, seller, customer)
- Lint-/review-checklista för att inte introducera nya fritextfält av misstag

### Agent 6 — Sök & autocomplete för organisationer

**Scope:** `apps/api/src/routes/auth.ts` (organizations/search), planerade
endpoints för CRM
**Leverans:** `06_search_autocomplete.txt`

Beskriv:
- Endpoint-signatur `GET /v1/organizations/search?q=...&riksorg=...&segment=...`
- ILIKE + trigram (pg_trgm extension) eller Postgres full-text
- Returnera: id, display_name, riksorganisation, segment, status, municipality
- Frontend-komponent (Combobox med fuzzy search, "skapa ny om saknas"-CTA)
- Hur befintlig `auth.get('/organizations/search')` ska migreras till nya modellen
- Throttling/debounce-rekommendation
- Cache-strategi (Redis 60s)

### Agent 7 — Admin-UI för masterdata

**Scope:** `apps/web/src/app/(portal)/portal/`
**Leverans:** `07_admin_ui.txt`

Beskriv för rollen INTERNAL_ADMIN:
- Ny sida `/portal/masterdata/riksorganisationer` (lista, lägg till, soft delete)
- Ny sida `/portal/masterdata/segment` (filtrera per riksorg)
- Bulk-import via CSV/XLSX (drag-and-drop)
- Bulk-edit med inline editing
- Audit-trail (vem ändrade vad — befintlig audit_logs)
- Ingen RBAC-läcka (endast INTERNAL_ADMIN, även backend-spärr)
- Komponentbibliotek att använda (DataTable, Dialog, Combobox från befintliga ui-komponenter)

### Agent 8 — Migrationsstrategi från befintlig `organizations`

**Scope:** Hela kodbasen där `organizations` används
**Leverans:** `08_migration_strategy.txt`

Beskriv:
- Inventering av alla queries/joins mot `organizations` (lista filer + rader)
- Backfill-script: matcha befintliga organisations-namn mot riksorg/segment via fuzzy + manuell review
- Två-stegs rollout: (1) lägg till nya kolumner nullable, (2) backfilla, (3) gör NOT NULL i v2
- Feature-flag-strategi (FEATURE_NEW_ORG_HIERARCHY) under migration
- Bakåtkompatibilitet med befintliga API-kontrakt (alias gamla fält)
- Dataloss-risker: vad gör vi med rader som inte matchar någon riksorg?
- Kopplingar att uppdatera: `users.orgId`, `teams.orgId`, `sellers` via team, `campaigns.orgId`,
  `quotes.orgId`, `customer_orders.orgId`
- Test: snapshot-jämförelse av API-svar före/efter migration

---

## Sub-agent prompt-mall

Använd denna mall för varje agent (fyll i `{N}`, `{NAME}`, `{SCOPE}`, `{DELIVERABLE}`,
`{INSTRUCTIONS}`):

```
Du är Plan-agent {N} för Roots feedback skill 01 (Masterdata-arkitektur):
{NAME}.

VIKTIGT: Detta är read-only. Du får INTE ändra någon källfil eller config.
Skriv ENDAST den slutliga .txt-filen i docs/feedback-plans/01-master-data/.

Källdokument du MÅSTE läsa innan du skriver planen:
- public/Feedback_14:5/Modell_register.docx
- public/Feedback_14:5/roots_master_riksorganisationer.xlsx
- public/Feedback_14:5/roots_segment_master_rekommenderad.xlsx
- packages/db/src/schema/organizations.ts
- packages/db/src/schema/users.ts
- packages/db/src/schema/teams.ts
- packages/db/src/schema/sellers.ts
- packages/db/drizzle/0000_premium_photon.sql
- docs/flow-audits/MASTER_PLAN_2026-04-18.md

Scope för din analys:
{SCOPE}

Din leverans (en .txt-fil):
{DELIVERABLE}

Konkreta instruktioner:
{INSTRUCTIONS}

Strukturera .txt-filen exakt så här:

==============================================
{N}. {NAME}
==============================================

NULÄGE
------
<vad finns redan i kodbasen — fil:rad-referenser>

VAD FEEDBACKEN SÄGER
--------------------
<citera/sammanfatta från Modell_register + Excel>

GAP
---
<konkret lista vad som saknas>

IMPLEMENTATION
--------------
<steg-för-steg, exakt vilka filer som ska skapas/ändras, schema-skiss,
endpoint-signaturer, UI-skiss, allt på den nivå att en utvecklare kan börja
direkt utan att gissa>

BAKÅTKOMPATIBILITET
-------------------
<hur befintlig funktionalitet skyddas — feature-flag, alias, additiv migration>

DEPENDENCIES
------------
<vilka andra sub-agents/skills detta beror på (t.ex. "kräver att agent 1 är klar"
eller "blockerar skill 02 agent 3")>

TESTPLAN
--------
<minst 5 konkreta tester, både unit och end-to-end>

RISKER
------
<dataloss, perf, RBAC, brand, support — vad kan gå snett>

UPPSKATTAD INSATS
-----------------
<dagar för en senior dev>

--- SLUT ---
```

---

## Checklista innan färdigt

- [ ] Alla 8 sub-agents har returnerat
- [ ] 8 separata .txt-filer skapade i `docs/feedback-plans/01-master-data/`
- [ ] Inga andra filer ändrade
- [ ] Varje fil följer mallen ovan
- [ ] Hänvisningar till befintliga filer/tabeller är konkreta (fil:rad)
- [ ] Bakåtkompatibilitet adresseras explicit
