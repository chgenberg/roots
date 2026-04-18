---
name: roots-ai-coach-flow-audit
description: >-
  Read-only audit of the AI / Open Claw layer across every role surface on
  Roots — public chat widget, portal assistant, seller coach, and sales-rep
  coach. Eight parallel sub-agents each inspect one angle and produce a
  prioritized .txt report. Use when asked to review AI features, LLM UX,
  guardrails, or the Open Claw assistant across the platform.
---

# Roots AI Coach Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of Roots' AI layer across every role
surface. This includes the public chat widget, logged-in portal assistant,
seller motivational coach, and sales-rep deal helper. Eight sub-agents run in
parallel and output a single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files.**

**Model rule:** All AI features MUST use GPT-5.4 or GPT-5.4-mini (per
`.cursor/rules/llm-models.mdc`). Any finding of deprecated models
(`gpt-4o`, `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-3.5-turbo`, etc.) is
**automatically Priority 1**.

## When to use

- User asks to audit the AI / Open Claw / chatbot layer
- User wants a review of LLM UX, guardrails, or prompt quality
- User asks to improve the AI assistant across roles

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/AI_COACH_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Public Chat Widget UX

**Scope:** `apps/web/src/components/chat-widget.tsx`, public chat endpoint

Look for:
- Widget floats over important content or CTAs
- First message doesn't clarify what the AI can help with
- Intent suggestions missing (chips: "How it works", "Pricing", "Book call")
- No human-handoff path when AI gets stuck
- Conversation history not persisted across page loads
- Widget blocks viewport on mobile

### Agent 2 — Portal AI Assistant (Authenticated)

**Scope:** Portal assistant surface, role-awareness

Look for:
- Assistant doesn't know current user's role (greets generically)
- Cannot reference user's campaign / team / account in answers
- Missing scope indicator ("I can help with your campaign, not billing")
- No visible reasoning / "thinking..." indicator during long replies
- Cannot be collapsed / moved
- Conversation not searchable or exportable

### Agent 3 — Seller AI Coach (Motivational)

**Scope:** AI features inside the seller dashboard

Look for:
- No proactive nudges ("Three friends haven't bought yet — want a draft message?")
- Can't draft share copy for WhatsApp / Instagram on request
- No image / video prompt helper
- Tone not age-appropriate (too corporate for 12-year-olds, too childish for 17-year-olds)
- Missing parent-visibility toggle for AI conversations with minors
- No guardrails against unrealistic earnings promises

### Agent 4 — Sales Rep AI Coach

**Scope:** AI features inside the sales rep portal

Look for:
- AI not grounded in rep's pipeline / account data
- Cannot draft a follow-up email referencing the right deal
- No "summarize this account" feature
- Missing call-prep brief before meetings
- Cross-rep data leakage risk (hallucinating competitors' accounts)
- No voice-to-note for field capture

### Agent 5 — Model Configuration & Compliance

**Scope:** All AI code paths — client + server

Look for:
- **Any use of deprecated models** (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-3.5-turbo) → **P1**
- Hardcoded model strings instead of env-driven defaults
- Missing `OPENAI_DEFAULT_MODEL` / `OPENAI_VISION_MODEL` env fallbacks
- Temperature / reasoning_effort not set appropriately per use case
- Max-tokens unbounded (cost risk)
- No per-role model override (mini for chat, full for complex)

### Agent 6 — Tone, Safety & Brand Voice

**Scope:** System prompts, response tone, refusal behavior

Look for:
- System prompt allows medical / health claims about skincare
- Pricing or refund policy hallucinated (not grounded in docs)
- No refusal for out-of-scope topics (politics, personal advice)
- Tone inconsistent with Swedish nordic-trust brand
- Swenglish leaking in ("let me help you", "absolutely")
- Missing source citation when quoting from docs / product sheets

### Agent 7 — Streaming, Abort, Regenerate UX

**Scope:** Streaming response handling in chat widget and portal assistant

Look for:
- No visible streaming cursor during response
- Can't abort a long response mid-stream
- No regenerate / "try again with different tone" action
- Copy-to-clipboard missing on AI messages
- Markdown / code / lists render as raw text
- Latency to first token not optimized

### Agent 8 — Fallback, Rate Limit & Observability

**Scope:** AI failure paths, rate limits, logging, cost controls

Look for:
- No fallback UI when `OPENAI_API_KEY` missing or OpenAI down
- Missing rate limit per user / IP (cost risk + abuse)
- No request/response logging for audit
- No cost tracking (tokens per org, per month)
- Prompt injection attempts not logged or flagged
- No kill-switch to disable AI platform-wide in an incident

---

## Sub-agent prompt template

```
You are AI Coach Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: Roots' AI layer must be role-aware, on-brand, and safe. All models
MUST be GPT-5.4 or GPT-5.4-mini per the platform rule. Deprecated model
references are automatic P1 findings. The audience ranges from 10-year-old
sellers to 60-year-old association treasurers, so tone and safety vary by
surface.

SCOPE:
{SCOPE}

CHECKLIST:
{CHECKLIST}

For each finding:

FINDING: <one-line summary>
PRIORITY: <1-5>
FILE: <path>
LINE: <line or range>
DETAIL: <explanation + fix>

Priority scale:
  1 — Critical: deprecated model, safety breach, prompt injection, cost runaway
  2 — High: hallucination risk, broken streaming, missing guardrail
  3 — Medium: UX polish, tone drift
  4 — Low: minor tweak
  5 — Nice-to-have: delighter / ambitious feature

Deprecated-model findings are ALWAYS priority 1.

Sort by priority.
```

---

## Report format

```
ROOTS AI COACH FLOW AUDIT
==========================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: AI across public widget, portal assistant, seller coach, sales coach
Model rule: GPT-5.4 / GPT-5.4-mini only (.cursor/rules/llm-models.mdc)

SUMMARY
-------
Total findings + P1-P5 counts

DEPRECATED MODEL USAGE (AUTO-P1)
---------------------------------
<list every file / line where a non-GPT-5.4 model is referenced>

SAFETY / TONE RED FLAGS
------------------------
<any P1/P2 findings related to safety, claims, minor-safety, prompt injection>

(findings by priority)

--- END OF REPORT ---
```

---

## Checklist before finishing

- [ ] All 8 agents completed
- [ ] Findings deduplicated
- [ ] Priority-tagged 1-5
- [ ] Deprecated-model findings are P1
- [ ] Sorted by priority
- [ ] Saved in `docs/flow-audits/`
- [ ] No source files modified
