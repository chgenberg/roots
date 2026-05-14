---
name: roots-feedback-03-hierarchy-groups
description: >-
  Plan för att införa hierarki-nivå 4 (Grupp/Lag/Klass) som egen tabell med
  separation mellan display_name (P10 Svart) och analysdata (gender=Male,
  birth_year=2010, age_band=Youth). Åtta read-only sub-agents producerar var
  sin .txt-plan i docs/feedback-plans/03-hierarchy-groups/. Använd när
  användaren vill kartlägga upgraden från befintlig teams-tabell till en
  fullständig group_unit-modell.
---

# Roots Feedback 03 — Hierarki & grupper (Lag / Klass)

## Syfte

Modell_register kap 7 är tydlig: Roots behöver en separat `group_unit`-tabell
under organisation, med strikt separation mellan **visningsdata**
(`display_name = "P10 Svart"`) och **analysdata** (`gender, birth_year,
age_band, group_type, competition_level`).

Den **kritiska principen** är att `birth_year` (2010) är konstant medan
"P10/U16" ändras varje år — analys ska alltid baseras på födelseåret.

Befintlig `teams`-tabell ska migreras, INTE rivas.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/03-hierarchy-groups/`.

## Källdokument

- `public/Feedback_14:5/Modell_register.docx` (kap 7, 8 + KRITISK PRINCIP)
- `packages/db/src/schema/teams.ts`
- `packages/db/src/schema/sellers.ts`
- `packages/db/src/schema/users.ts`
- `apps/api/src/routes/auth.ts` (registreringsflöden för team_leader/seller)
- `apps/web/src/app/(portal)/portal/saljare/page.tsx`
- `docs/flow-audits/SELLER_2026-04-18_1245.txt`
- `docs/flow-audits/TEAM_LEADER_2026-04-18_1243.txt`
- `docs/flow-audits/MASTER_PLAN_2026-04-18.md`

## Arbetssätt

8 sub-agents parallellt. Output i `docs/feedback-plans/03-hierarchy-groups/`:

```
01_group_unit_schema.txt
02_birth_year_age_band_principle.txt
03_team_to_group_migration.txt
04_create_group_ui.txt
05_seller_group_relationship.txt
06_school_class_variant.txt
07_scout_association_variant.txt
08_analytics_dimensions.txt
```

---

## De 8 sub-agents

### Agent 1 — `group_unit`-tabellens schema

**Scope:** `packages/db/src/schema/`
**Leverans:** `01_group_unit_schema.txt`

Beskriv enligt Modell_register kap 7:
- `id`, `organization_id` FK, `display_name`, `normalized_name`
- `group_type` ENUM (Team, Class, ScoutGroup, AssociationGroup, Other)
- `gender` ENUM (Male, Female, Mixed, Unknown)
- `birth_year` int (kärn-analysfältet)
- `age_band` ENUM (Child, Youth, Junior, Senior, Veteran)
- `school_grade` int (för Class)
- `competition_level` ENUM (Recreational, Competitive, Elite, Unknown)
- `active_season` int (år)
- `estimated_members`, `verified_members` int
- `status` ENUM, `created_at`, `updated_at`
- Index: (organization_id, status), (birth_year), (group_type)
- Index för analys: (organization_id, gender, birth_year)
- Computed-fält? `current_age = current_year - birth_year`

### Agent 2 — Den kritiska principen birth_year + age_band

**Scope:** Modell_register kap 7 + 8, hela analyslagret
**Leverans:** `02_birth_year_age_band_principle.txt`

Beskriv:
- VARFÖR `birth_year` är konstant och `display_name` ("P10") är variabel
- Mapping `birth_year → age_band` (auto-utfyllt vid create)
- Auto-rull-script som varje 1/1 uppdaterar age_band om en grupp passerat ålder
- BI-implication: alla aggregat ska gå mot birth_year (eller cohort), inte
  display_name
- App-side helpers: `getAgeBand(birthYear, asOfYear)`, `getCurrentDisplayLabel`
- Diagram-exempel (visa hur F2010 förblir samma kohort 2026 vs 2027)

### Agent 3 — Migration från befintlig `teams`

**Scope:** Hela kodbasen där `teams` används
**Leverans:** `03_team_to_group_migration.txt`

Beskriv:
- Inventering: alla queries och joins mot `teams` (filer + rader)
- Plan A: Behåll `teams` som lättviktig "campaign team grouping", lägg till
  `group_unit_id` FK från `teams` → ny tabell
- Plan B: Migrera `teams` → `group_unit` med backfill
- Rekommendera Plan A (mindre invasiv, bevarar `teams.inviteToken`,
  `teams.campaignId`, `teams.memberCount`)
- AI-parsing av befintliga `teams.name` ("P10 Svart" → gender/birth_year) — se
  skill 04 agent 2
- Bakåtkompatibilitet med befintlig `/v1/auth/register/team-leader`
- Stegvis rollout med feature-flag

### Agent 4 — UI: skapa & redigera grupp/lag

**Scope:** `apps/web/src/app/(portal)/portal/`, registreringsflöden
**Leverans:** `04_create_group_ui.txt`

Beskriv formulärflödet:
1. Användaren skriver `display_name` ("P10 Svart")
2. AI-parsing-förslag visas i realtid (gender=Male, birth_year=2010, age_band=Youth)
3. Användaren kan acceptera eller justera dropdowns manuellt
4. Validation: minst en av (birth_year, school_grade) krävs
5. `estimated_members` slider med realtid uppskattning
6. Save → audit-logga create
- Wizard-steg vid kampanjsetup (skill 05): bulk-create flera grupper på en gång
- Komponent-återanvändning (Combobox för dropdowns, befintliga ui/-komponenter)

### Agent 5 — Säljarens koppling till grupp

**Scope:** `packages/db/src/schema/sellers.ts`, `auth.ts (register/seller)`
**Leverans:** `05_seller_group_relationship.txt`

Beskriv:
- Lägg till `sellers.group_unit_id` (additivt FK, nullable initialt)
- Sambandet: en säljare tillhör en grupp, en grupp har 0..N säljare
- Migration: backfilla från `sellers.team_id → teams.group_unit_id`
- UI: när en säljare-invite genereras, vald grupp följer med och säljarens
  shop visar t.ex. "P10 Svart, Onsala BK"
- `seller.role` ENUM (Player, Parent, Student, Coach, Teacher, Administrator,
  Other) — additivt på `sellers`
- Kopplar till skill 06 (campaign execution / leaderboards per grupp)

### Agent 6 — Variant: Skola / Klass

**Scope:** Modell_register kap 6 + 7 (Class), Excel-data om Sveriges Elevråd/Elevkårer
**Leverans:** `06_school_class_variant.txt`

Beskriv hur en `group_unit` används för en skolklass:
- `group_type = "Class"`
- `school_grade` (1–12) istället för / utöver `birth_year`
- `gender = "Mixed"` per default
- `display_name` exempel: "Klass 9B", "9B Vivalla"
- Andra fält som spelar roll (klassresemål, förälderkontakt)
- UI-anpassning: enklare formulär utan "competition_level"
- Onboarding-kopia (vad lärare ser jämfört med fotbollscoach)

### Agent 7 — Variant: Scoutkår / Föreningsgrupp

**Scope:** Modell_register, Excel (Scouterna, 4H, KFUM, etc.)
**Leverans:** `07_scout_association_variant.txt`

Beskriv:
- `group_type = "ScoutGroup"` eller `"AssociationGroup"`
- Multi-åldersgrupper (en scoutpatrullkan ha 8–14-åringar)
- Hur `birth_year` hanteras när det finns spridning (range? majoritet?)
- Roller: Patrulledare, Avdelningschef
- UI/copy-anpassning för scout-/föreningskontext

### Agent 8 — Analytics & BI-dimensioner

**Scope:** Modell_register kap 14–15, planerad BI-arkitektur
**Leverans:** `08_analytics_dimensions.txt`

Beskriv vilka analyser hierarki-modellen möjliggör:
- Genomsnittlig försäljning per kohort (birth_year)
- Per gender, per segment, per region/municipality
- Per group_type (Team vs Class)
- Per competition_level
- Vinnar-formler: kombinerar org.lead_source × group.competition_level →
  potential_score
- Föreslagen materialiserad vy `mv_group_unit_performance` (uppdateras nattligen)
- Hur Power BI / Metabase-koppling ska byggas (read-replica? CDC?)
- GDPR-aspekt: aggregat ALDRIG på enskild seller-nivå utan samtycke

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/03-hierarchy-groups/`. Markera
explicit dependencies på skill 01 (org.id måste finnas), skill 02
(`assigned_asm` per org), skill 04 (AI-parsing), skill 06 (gamification per
grupp).

## Checklista

- [ ] 8 .txt-filer i `docs/feedback-plans/03-hierarchy-groups/`
- [ ] Bakåtkompatibilitet med `teams` adresserad
- [ ] Den kritiska birth_year-principen tydligt motiverad
