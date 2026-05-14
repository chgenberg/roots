---
name: roots-feedback-07-data-quality-bi
description: >-
  Plan för datakvalitet (estimat vs verifierad, källa/kvalitet/datum) och
  BI-fundament (created/updated/deleted_at, status, owner, source, retention,
  ASM-performance, churn). Åtta read-only sub-agents producerar var sin .txt-
  plan i docs/feedback-plans/07-data-quality-bi/. Använd när användaren vill
  kartlägga vägen till en mätbar, BI-redo plattform enligt Modell_register
  kap 14–15.
---

# Roots Feedback 07 — Datakvalitet & BI-fundament

## Syfte

Modell_register kap 14–15 beskriver två saker som måste byggas IN i alla
tabeller från start:

1. **BI-fält:** `created_at`, `updated_at`, `deleted_at` (soft delete) +
   per huvudobjekt: `status`, `active`, `owner` / `assigned_asm`, `source`
2. **Måtten plattformen ska kunna producera:** retention, repeat purchase,
   subscription potential, churn, konvertering, kampanjeffektivitet på
   alla nivåer i hierarkin.

Plus principen **estimat vs verifierad** med `data_source`, `data_quality`,
`last_verified_at`.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/07-data-quality-bi/`.

## Källdokument

- `public/Feedback_14:5/Modell_register.docx` (kap 13–15 + sista stycket om
  estimat-fält)
- Hela `packages/db/src/schema/`
- `apps/api/src/routes/portal.ts` (`/statistics`, `/system`)
- `apps/web/src/app/(portal)/portal/statistik/page.tsx`
- `docs/flow-audits/INTERNAL_ADMIN_2026-04-18_1310.txt`
- `docs/flow-audits/MASTER_PLAN_2026-04-18.md`

## Arbetssätt

8 sub-agents parallellt. Output i `docs/feedback-plans/07-data-quality-bi/`:

```
01_bi_columns_audit.txt
02_soft_delete_strategy.txt
03_data_source_quality.txt
04_audit_log_extension.txt
05_metrics_catalog.txt
06_dashboard_redesign.txt
07_data_warehouse_export.txt
08_background_workers.txt
```

---

## De 8 sub-agents

### Agent 1 — Audit av BI-kolumner i alla tabeller

**Scope:** Hela `packages/db/src/schema/`
**Leverans:** `01_bi_columns_audit.txt`

Beskriv:
- Tabell-för-tabell-checklista: har den `created_at`, `updated_at`,
  `deleted_at`, `status`, `owner`, `source`?
- Tabeller där det saknas → konkret ALTER-skiss
- Trigger för `updated_at` (Postgres BEFORE UPDATE) eller app-side?
- Drizzle-helper för att alltid lägga till basfält (helper
  `withBaseColumns(table)`)
- Naming convention (alltid snake_case i DB, camelCase i app)
- Hur "owner" definieras: user_id eller asm_user_id?

### Agent 2 — Soft delete-strategi

**Scope:** Alla tabeller, query-lagret
**Leverans:** `02_soft_delete_strategy.txt`

Beskriv:
- `deleted_at` på alla huvudtabeller (org, group_unit, seller, customer,
  campaign, etc.)
- Default-filter i Drizzle (`where(isNull(t.deletedAt))`) — wrapper-funktion
- INTERNAL_ADMIN kan se "Papperskorgen" / återställa
- Hard delete bara via cron efter 90 dagar + audit-log
- FK-beteende: ON DELETE RESTRICT vs CASCADE när rad soft-deletas
- Search-index-uppdatering vid soft delete
- GDPR-aspect: "right to erasure" → faktiskt hard delete på begäran med audit

### Agent 3 — `data_source` + `data_quality` + `last_verified_at`

**Scope:** Modell_register sista stycket; relevant för organizations + group_unit
**Leverans:** `03_data_source_quality.txt`

Beskriv:
- ENUM `data_source`: ASM / Förening / Hemsida / Import / AI / Manuell
- ENUM `data_quality`: Låg / Medel / Hög
- `last_verified_at TIMESTAMP`, `verified_by_user_id FK`
- Per-fält-versionering vs per-rad: rekommendera per-rad i v1
- UI: badges vid varje fält, "Senast verifierat 2026-03-01 av Anna"
- "Verifiera"-knapp som loggar vem + när
- Estimat vs verifierad-skillnad i BI-aggregat (ALDRIG blanda)
- Modell för flera estimat över tid (`estimate_history`-tabell?)

### Agent 4 — Utökning av befintlig audit-log

**Scope:** `apps/api/src/lib/audit.ts`, `packages/db/src/schema/audit.ts`
**Leverans:** `04_audit_log_extension.txt`

Beskriv:
- Nuvarande tabell `audit_logs` (id, user_id, action, entity_type, entity_id, meta, created_at)
- Nya konventionella `action`-namn:
  org.created/updated/status_changed/merged/deleted
  group.created/parsed_by_ai/...
  campaign.created/activated/settled/...
  ai_agent.org_normalizer.suggested
  data.verified
- Compliance-rapport: GDPR-export per användare (vilka audit-rader rör dig)
- Retention: 365 dagar i hot, archive till S3/object store
- Query-helpers: "audit för organization X"
- UI för INTERNAL_ADMIN: söka audit-trail

### Agent 5 — Mätetal-katalog

**Scope:** Alla nivåer i hierarkin (riks/segment/org/group/seller)
**Leverans:** `05_metrics_catalog.txt`

Beskriv (Modell_register kap 15) per nivå:
- Riksnivå: total intäkt, antal aktiva organisationer, ASM-coverage,
  segment-fördelning
- Segmentnivå: konversion (lead→customer), avg deal size, repeat rate
- Föreningsnivå: total per kampanj, ASM-tilldelning, payout history,
  subscription LTV
- Gruppnivå: paket per medlem, retention år-över-år
- Säljarnivå: paket sålda, snitt per kund, social-share-rate, dropoff
- Konkret SQL-skiss per mätetal
- Materialiserade vyer (mv_org_perf, mv_segment_perf) — uppdatering nattligen
- Dimensions-cubes för ad-hoc-analys
- ASM-performance: pipeline velocity, win rate, time-to-active

### Agent 6 — Dashboard-omdesign

**Scope:** `apps/web/src/app/(portal)/portal/`, `/statistik`, ny `/insights`
**Leverans:** `06_dashboard_redesign.txt`

Beskriv vad varje roll ser:
- INTERNAL_ADMIN: hela kataogen, drilldown alla nivåer
- ASM: "Mina organisationer", pipeline velocity, win rate
- ASSOCIATION_ADMIN: föreningens KPI, lag-perf, säljar-perf, payouts
- TEAM_LEADER: lagets perf, säljarnas perf
- SELLER: egen perf + lagets sammanhang
- Konsekvent komponentbibliotek (KpiCard, TrendChart, Leaderboard)
- Tids-väljare (idag / 7d / 30d / kampanj / all-time)
- Export till CSV/PDF
- Befintlig `statistik/page.tsx` har redan tomma states; vidareutveckla, inte
  ersätt

### Agent 7 — Data warehouse / BI-export

**Scope:** Future-tooling
**Leverans:** `07_data_warehouse_export.txt`

Beskriv:
- Read-replica-strategi (Railway/Supabase)
- CDC-överväganden (Debezium / pgoutput / enkla nattliga ETL)
- Format: Parquet i S3? Direct-Power-BI-koppling?
- Schema-första-design: skapa `analytics`-schema med stabilt PII-skrubbat
  schema
- Roller: BI-konsumenter får read-only via warehouse, aldrig direkt mot prod
- GDPR: pseudonymisering av PII innan warehouse
- Plan för v1 (manuell CSV-export) → v2 (read-replica) → v3 (warehouse)

### Agent 8 — Background workers (pg-boss / cron)

**Scope:** Ny `apps/api/src/workers/`, koppling till MASTER_PLAN-fasen
**Leverans:** `08_background_workers.txt`

Beskriv jobb som krävs för BI och AI:
- Nattlig org.status auto-transition (Active → Inactive efter 12 mån)
- Nattlig potential_score recompute
- Nattlig duplicate-sweep
- Nattlig MV refresh
- Nattlig age_band rull (1/1)
- E-post-digest till ASM med "leads som väntar"
- Webhook-retry för Klarna/Fortnox
- pg-boss vs Bull vs Inngest — välj och motivera (pg-boss föreslagen i master
  plan)
- Observability: jobb-log, larm vid failures
- Bakåtkompatibilitet: idempotens, kan re-köras

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/07-data-quality-bi/`.

## Checklista

- [ ] 8 .txt-filer
- [ ] Befintlig audit-log återanvänds, inte ersätts
- [ ] Soft delete strategiskt valt (med GDPR-undantag)
- [ ] BI-fält införs additivt
