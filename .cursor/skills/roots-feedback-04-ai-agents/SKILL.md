---
name: roots-feedback-04-ai-agents
description: >-
  Plan för Modell_registers fyra AI-agenter — organisationsnormalisering,
  gruppnormalisering, lead scoring och duplikatkontroll — samt två extra
  (estimat-uppskattning, intent/playbook-coach). Åtta read-only sub-agents
  producerar var sin .txt-plan i docs/feedback-plans/04-ai-agents/. Använd
  när användaren vill kartlägga AI-agent-svit byggd ovanpå befintlig OpenAI-
  integration.
---

# Roots Feedback 04 — AI-agent-svit

## Syfte

Modell_register kap 12 listar 4 AI-agenter:

1. **Organisationsnormalisering** ("Särö Kullavik" vs "Särö Kullavik IF")
2. **Gruppnormalisering** ("P10 Svart" → gender/birth_year/age_band)
3. **Lead scoring** (potential_score baserat på sport/storlek/kommun/aktivitet)
4. **Duplikatkontroll** (organisationer/grupper/kunder)

Vi lägger till två naturliga komplement för att uppfylla feedbacken:

5. **Estimat-uppskattning** av medlemsantal/lag (`estimated_members`)
6. **Säljar-coach** för räknesnurra/invändningshantering (kopplar till Säljprocess)

Befintlig OpenAI-integration (`openclaw-client.ts`) återanvänds; ingen ny
provider behövs.

**STRIKT READ-ONLY.** Sub-agents skriver ENDAST .txt-planer i
`docs/feedback-plans/04-ai-agents/`.

## Källdokument

- `public/Feedback_14:5/Modell_register.docx` (kap 8, 12)
- `public/Feedback_14:5/Säljprocess.pptx` (för säljar-coach)
- `apps/api/src/lib/ai/openclaw-client.ts`
- `apps/api/src/lib/ai/system-prompt.ts`
- `apps/api/src/routes/ai-chat.ts`
- `apps/api/src/routes/public-chat.ts`
- `apps/api/src/routes/hair-analysis.ts` (Vision-mönstret)
- `apps/api/src/lib/flags.ts` (AI_ENABLED-flagga)
- `apps/api/src/lib/audit.ts`
- `docs/flow-audits/AI_COACH_2026-04-18_1312.txt`

## Arbetssätt

8 sub-agents parallellt. Output i `docs/feedback-plans/04-ai-agents/`:

```
01_organization_normalizer.txt
02_group_normalizer.txt
03_lead_scoring.txt
04_duplicate_detector.txt
05_member_estimator.txt
06_sales_coach.txt
07_agent_runtime_and_queue.txt
08_observability_and_cost.txt
```

---

## De 8 sub-agents

### Agent 1 — Organisationsnormalisering

**Scope:** Ny tjänst `apps/api/src/lib/ai/agents/org-normalizer.ts`
**Leverans:** `01_organization_normalizer.txt`

Beskriv:
- Input: rå sträng + ev. municipality/postal_code från användarinmatning
- Trigger-punkter: vid org-create, vid lead-import
- Pipeline: (1) lokal normalisering (lowercase, ta bort "IF"/"BK"/"FK" suffix),
  (2) fuzzy match (pg_trgm) mot befintliga org, (3) om ingen tydlig match → AI
  call som returnerar JSON `{normalized_name, confidence, alternatives[]}`
- Prompt-skiss (system + few-shot)
- När en match med >0.85 conf hittas → föreslå merge istället för create
- UI: "Menade du Särö Kullavik IF?" inline-banner
- Cache: Redis nyckel `org:norm:<sha>`, TTL 7 dagar
- Token-budget per anrop (~500)

### Agent 2 — Gruppnormalisering ("P10 Svart" → struktur)

**Scope:** Ny `apps/api/src/lib/ai/agents/group-parser.ts`
**Leverans:** `02_group_normalizer.txt`

Beskriv enligt Modell_register kap 8:
- Input: `display_name` + ev. organization (för sport-kontext)
- Output JSON: `{gender, birth_year, age_band, group_type, competition_level, confidence}`
- Lokala regex-fallbacks före AI (P|F + 2 siffror, "Herr"/"Dam"/"Dam jun")
- Few-shot prompt med 10 exempel (P10 Svart, F14 Vit, Herrjunior, Klass 9B,
  U17 Damer, Damjuniorer)
- Användaren får alltid justera manuellt
- Trigger: vid skapande av group_unit
- Bulk-läge för CSV-import
- Confidence-tröskel: <0.7 = visa som "förslag", >0.9 = auto-fill

### Agent 3 — Lead scoring

**Scope:** Ny `apps/api/src/lib/ai/agents/lead-scorer.ts`,
`organizations.potential_score`
**Leverans:** `03_lead_scoring.txt`

Beskriv:
- Hybrid-formel: regelbaserad bas + AI-justering
- Faktorer: segment.avg_per_member × estimated_members, ASM:s historik med
  liknande org, region, konkurrenters närvaro, säsong
- Output: 0–100 score + "Top 3 reasons"
- Schema: `potential_score INT`, `potential_score_breakdown JSONB`,
  `potential_score_updated_at`
- Re-scoring nattligen via worker (kopplar till skill 07 BI / pg-boss)
- Endast INTERNAL_ADMIN/ASM ser score; INTE säljaren
- Fairness: ingen score baserad på namn/personliga data
- A/B-test: score vs ASM:s magkänsla efter 3 mån

### Agent 4 — Duplikatkontroll

**Scope:** `organizations`, `group_unit`, `customers`, ny tabell `duplicate_candidates`
**Leverans:** `04_duplicate_detector.txt`

Beskriv:
- Schemaläggning: nattlig sweep + on-create-check
- Pipeline: pg_trgm similarity > 0.7 ⇒ AI-bedömning ⇒ skapar `duplicate_candidate`-rad
- UI för INTERNAL_ADMIN: "Förslag på dubletter" lista, side-by-side jämförelse,
  Merge / Reject / Mark not-duplicate-knappar
- Merge-logik: håll äldsta ID, flytta alla FK:s, soft-delete andra
- Audit-log för varje merge
- Skydd: aldrig auto-merge utan manuellt godkännande i v1
- Hantering av kund-PII (skip dedup på e-post utan att hash:a först)

### Agent 5 — Estimator för medlems-/lag-antal

**Scope:** Ny `apps/api/src/lib/ai/agents/member-estimator.ts`,
`organizations.estimated_members`, `data_source`, `data_quality`
**Leverans:** `05_member_estimator.txt`

Beskriv (Modell_register sista stycket — "antal lag/medlemmar"):
- Input: organization + segment + municipality
- Output: `{estimated_members, estimated_teams, confidence, sources[]}`
- Källor: laget.se-scraping (Q2 efter v1), publik webbsida-fetch, AI-prior baserat på segment-snitt
- ALWAYS märka `data_source = "AI"` och `data_quality = "låg"` initialt
- ASM/förening kan bekräfta → `verified_members`, `data_source = "förening"`,
  `data_quality = "hög"`, `last_verified_at`
- Visa data-quality-badge i UI ("Uppskattat" / "Bekräftat 2026-03-01")
- Etisk: aldrig publicera estimerade siffror externt

### Agent 6 — Säljar-coach (räknesnurra + invändningar)

**Scope:** Befintlig `/portal/ai`, `system-prompt.ts`
**Leverans:** `06_sales_coach.txt`

Beskriv kopplingen till Säljprocess.pptx:
- Roll-prompt för SALES_REP/ASM utöver befintlig: tillgång till
  invändningshantering ("föräldrar har inte tid", "för dyrt", "vi kör Newbody")
- "Räknesnurran"-tool: AI får anropa funktion `calculate_revenue(members,
  packages_per_member, package_price)` och returnerar formatterad text +
  ev. tabell
- Mötesstruktur-mall hämtad från `Säljprocess.pptx` slide 4
- Aldrig lova specifika belopp (befintlig guardrail i system-prompt)
- Audit: logga vilka invändningar säljarna oftast frågar om → input till
  playbook-uppdatering

### Agent 7 — Agent-runtime, kö och idempotens

**Scope:** `apps/api/src/lib/ai/`, planerad pg-boss-integration (skill 07)
**Leverans:** `07_agent_runtime_and_queue.txt`

Beskriv:
- Standardgränssnitt: `interface AiAgent<I,O> { run(input: I): Promise<O> }`
- Inline (synchronous, < 3s) vs async (queue) — vilka agents passar var
- Kö-strategi: pg-boss `ai-jobs` med retry/backoff
- Idempotens-nyckel per anrop (för att undvika dubbla AI-kostnader vid retry)
- Resultat-cache (samma input → samma output i N dagar)
- Master-flagga `AI_ENABLED` (finns), per-agent-flagga (`FEATURE_AI_ORG_NORM`)
- Kompatibilitet med befintlig `chatCompletion` / `chatCompletionStream`

### Agent 8 — Observability, kostnad och kvalitet

**Scope:** Loggning, metrics, prompt-versionering
**Leverans:** `08_observability_and_cost.txt`

Beskriv:
- Loggningstabell `ai_agent_runs`: agent_name, prompt_version, input_hash,
  output, tokens_in, tokens_out, model, latency_ms, cost_estimate, success
- Daily/månadsvis kostnadsdashboard per agent (kopplar till `/portal/system`)
- Prompt-versionering (semver, gradvis rollout, A/B)
- Kvalitetsmått: human-feedback-knapp ("Korrekt?" på AI-förslag) + sammanställning
- Throttling globalt + per agent
- Larmtrösklar (cost > X kr/dag → Slack)
- Hänvisa till befintlig `audit_logs` (för "vem ändrade efter AI-förslag")

---

## Sub-agent prompt-mall

Som skill 01. Output i `docs/feedback-plans/04-ai-agents/`.

## Checklista

- [ ] 8 .txt-filer
- [ ] Återanvänder befintlig OpenAI-integration, ingen ny provider
- [ ] AI_ENABLED-flaggans roll dokumenterad
- [ ] Bakåtkompatibilitet med befintliga AI-endpoints adresserad
