---
name: roots-sales-rep-flow-audit
description: >-
  Read-only audit of the internal sales rep portal on Roots — pipeline, quote
  creation, activity tracking, and commission visibility. Eight parallel
  sub-agents each inspect one angle and produce a prioritized .txt report.
  Use when asked to review the sales portal, CRM-like flows, or the
  field-sales experience.
---

# Roots Sales Rep Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the internal sales rep portal on
Roots — the field-sales or inside-sales employee managing a pipeline of
associations and clubs, building quotes, and tracking their commission.
Eight sub-agents run in parallel and output a single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files.**

## When to use

- User asks to audit the sales rep portal / CRM flow
- User wants a review of pipeline, quote creation, or commission UX
- User asks to improve the field-sales daily workflow

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/SALES_REP_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Pipeline & Deal Management

**Scope:** `apps/web/src/app/(sales)/` pipeline, kanban / list views, deal cards

Look for:
- Pipeline stages unclear or not editable
- Can't drag-and-drop deals between stages on desktop
- No at-a-glance view of "deals needing follow-up today"
- Deal value / probability / close date not all visible on the card
- Missing bulk actions (reassign, close lost, tag)
- No filter persistence across sessions

### Agent 2 — Quote Creation Flow

**Scope:** Quote builder, product picker, discount controls, PDF preview

Look for:
- Product picker slow / lacks search as you type
- Discount field doesn't respect min-margin rules
- No save-as-draft, quotes lost on navigation
- PDF preview missing or unbranded
- Quote expiry date not suggested by default
- Can't duplicate a previous quote as starting point

### Agent 3 — Customer / Account Management

**Scope:** Account detail pages, contacts, notes, activity log

Look for:
- Account detail doesn't surface recent orders and open quotes together
- No multi-contact support on an account (several coaches, one board)
- Notes editor too rigid (no @mentions, no attachments)
- Activity timeline missing key events
- No merge-duplicates tool
- Contact opt-out / GDPR consent not visible

### Agent 4 — Commission & Incentive Visibility

**Scope:** Commission dashboard, rep stats, leaderboards

Look for:
- Rep can't see their month-to-date commission easily
- Commission formula opaque ("black box" calculation)
- No "how to reach bonus tier" visualization
- Team leaderboard shames instead of motivates
- Missing payout history
- Stats not filterable by campaign, product, or account

### Agent 5 — Activity Tracking & Follow-Ups

**Scope:** Tasks, reminders, calendar, email / call logging

Look for:
- No task list / "today's focus" view
- Reminders missing push / email notification
- Can't log a call in under 10 seconds (too many fields)
- No calendar integration (Google / Outlook)
- Missing snooze on tasks
- No automated follow-up suggestion based on deal stage

### Agent 6 — Reports & Personal Metrics

**Scope:** Personal report builder, export, share with manager

Look for:
- Only fixed reports, no custom filters
- Export broken or limited to CSV
- No week-over-week / month-over-month comparison
- Shareable report link missing
- Manager can't comment on rep's report
- Key metric definitions not documented

### Agent 7 — AI Sales Coach Integration

**Scope:** AI assistant scoped to sales rep role

Look for:
- AI not aware of the rep's current pipeline / deals
- Suggested next actions missing
- No "draft follow-up email" helper
- AI can hallucinate account details (no grounding in DB)
- Missing role-based guardrails (shouldn't share other reps' data)
- No voice-input for field notes

### Agent 8 — Mobile Field Sales

**Scope:** Sales portal at 375px — reps are on the road

Look for:
- Pipeline kanban unusable on mobile
- Quote builder desktop-only
- Calendar / task flow breaks on small screens
- No offline mode for poor-coverage areas
- Touch targets in deal list too small
- No quick-voice-note capture

---

## Sub-agent prompt template

```
You are Sales Rep Flow Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: The sales rep is a Roots employee handling B2B accounts (associations,
clubs, schools). They work partly on the road (phone) and partly at a desk.
Their day is about moving deals forward, keeping quotes current, and staying
on top of follow-ups. Speed and clarity matter more than features.

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
  1 — Critical: blocks quote creation, breaks pipeline integrity
  2 — High: forces workaround, slows daily workflow significantly
  3 — Medium: UX polish
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority.
```

---

## Report format

```
ROOTS SALES REP FLOW AUDIT
===========================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Sales rep pipeline, quotes, accounts, commission, mobile field workflow

SUMMARY
-------
Total findings + P1-P5 counts

TIME-TO-QUOTE TOP ACCELERATORS
-------------------------------
<3-5 changes that would speed up quote creation>

(findings by priority)

--- END OF REPORT ---
```

---

## Checklist before finishing

- [ ] All 8 agents completed
- [ ] Findings deduplicated
- [ ] Priority-tagged 1-5
- [ ] Sorted by priority
- [ ] Saved in `docs/flow-audits/`
- [ ] No source files modified
