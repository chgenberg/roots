---
name: roots-hair-analysis-composer
description: >-
  Build or extend the Roots online hair analysis lead magnet (GPT Vision, wizard, recommendations)
  using the eight agent strategy documents in docs/composer-agents/hair-analysis/.
  Use when implementing hair analysis UX, API, vision prompts, or compliance.
---

# Roots — Hair Analysis (Composer 2.0)

## When to use

- Hero CTA / modal wizard for **håranalys**
- **GPT Vision** image flows (back + top), questionnaire, recommendations
- **Privacy, consent, disclaimers** for consumer-facing analysis

## Source of truth

Plain-text specs:

`docs/composer-agents/hair-analysis/`

| File | Focus |
|------|--------|
| `INDEX.txt` | Overview, build order |
| `01_UX_FLOW_IA_CONSENT.txt` | Steps, consent, lead capture |
| `02_VISUAL_COPY_MICROCOPY.txt` | Tone, spacing, no emoji in UI |
| `03_FRONTEND_WIZARD_UPLOAD.txt` | React wizard, upload, a11y |
| `04_BACKEND_API_STORAGE.txt` | API contract, storage policy |
| `05_VISION_MODEL_SAFETY.txt` | Model, prompts, safety |
| `06_QUESTIONNAIRE_LOGIC.txt` | Questions, branching |
| `07_RECOMMENDATIONS_ENGINE.txt` | Lifestyle, nutrition, Roots products |
| `08_SECURITY_PRIVACY_LEGAL.txt` | GDPR, disclaimers |
| `MASTER_BUILD_CHECKLIST.txt` | Phased checklist |

## Hard constraints

1. **No API keys in the browser** — all Vision calls via backend BFF.
2. **No emoji** in UI copy (brand rule).
3. **Medical disclaimer** — analysis is indicative, not a diagnosis.
4. **Images:** prefer no persistent server storage in MVP; discard after analysis unless legal approves retention.

## Workflow

1. Open the relevant `0X_*.txt` for the task.
2. Follow `MASTER_BUILD_CHECKLIST.txt` for full builds.
3. Keep recommendations aligned with Roots three SKUs (shampoo, conditioner, body wash / bundle).
