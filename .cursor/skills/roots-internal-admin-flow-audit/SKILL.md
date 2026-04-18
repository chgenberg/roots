---
name: roots-internal-admin-flow-audit
description: >-
  Read-only audit of the internal admin oversight flow on Roots — system
  health, org management, campaign oversight, support tooling, and analytics.
  Eight parallel sub-agents each inspect one angle and produce a prioritized
  .txt report. Use when asked to review the internal admin portal, operations
  tooling, or backend oversight UX.
---

# Roots Internal Admin Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the internal admin portal on
Roots — the operational surface used by Roots employees to monitor system
health, oversee campaigns, assist customers, moderate content, and access
business-wide analytics. Eight sub-agents run in parallel and output a single
prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files.**

## When to use

- User asks to audit the internal admin / operations flow
- User wants a review of support tooling, moderation, analytics
- User asks to improve the backstage / ops experience

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/INTERNAL_ADMIN_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — System Health Dashboard

**Scope:** Internal portal overview, system status, alerts

Look for:
- No at-a-glance health panel (API up, DB healthy, queue lag)
- Alerts not surfaced to internal admins
- Missing rate of key business events (orders/hour, signups/day)
- No incident banner mechanism
- Third-party dependency status not shown (OpenAI, Fortnox, mail)
- No uptime / response-time trend

### Agent 2 — User & Role Management Across Orgs

**Scope:** User lookup, role assignment, org membership tools

Look for:
- User search requires exact email (no fuzzy / partial)
- Can't see which orgs a user belongs to from their profile
- Role changes lack audit trail
- Bulk role updates absent
- No "login as" / impersonation with audit
- GDPR delete-user workflow missing or unclear

### Agent 3 — Campaign Oversight & Intervention

**Scope:** Campaign list, drill-in, pause / flag / contact

Look for:
- Can't filter campaigns by status, performance, risk
- No way to proactively flag underperforming campaigns
- Intervention actions (pause, contact, extend) require multiple clicks
- No campaign comparison tool
- Missing "anomaly detected" alerts (fake orders, refund spikes)
- No export of campaign list for BI tools

### Agent 4 — Financial Overview (Read-Only)

**Scope:** Revenue dashboards, payout tracking, dispute overview (NOT Fortnox integration specifics)

Look for:
- Revenue by product / campaign / region not easily filterable
- Payout status to associations hard to verify at a glance
- Disputes / chargebacks / refunds not consolidated
- No forecasted revenue vs. actual view
- Missing MRR-equivalent metric for B2B clubs
- No alert for unusual payout lag

### Agent 5 — Content Moderation

**Scope:** Seller content (photos, messages, shop text), chat logs, flagged items

Look for:
- No queue of flagged seller content
- Can't review / approve seller photos before they go public
- No profanity / safety filter on personal messages
- Chat logs not searchable
- Missing takedown mechanism (hide seller page pending review)
- No audit log of moderation actions

### Agent 6 — Support Tooling

**Scope:** Impersonation (with audit), password reset, order lookup, refund trigger

Look for:
- Support can't quickly find an order by partial info
- No one-click "resend confirmation email"
- Password reset on behalf of user missing
- Impersonation lacks visible banner / audit
- Support notes aren't tied to user / order
- No shared macros / response templates

### Agent 7 — Analytics & Business Intelligence

**Scope:** Admin analytics pages, exports, cohort views

Look for:
- Only daily granularity, no hourly for event spikes
- Cohort analysis (signup month → retention) missing
- No segment-by-org-type (idrott vs skola vs kultur) views
- Charts without context (no comparison period, no benchmark)
- Exports limited to CSV, no Looker/Metabase handoff
- Missing data dictionary for metrics

### Agent 8 — Audit Log & Compliance

**Scope:** Action audit log, GDPR compliance, data-access traceability

Look for:
- No immutable audit log of admin actions
- Audit log not searchable / filterable
- GDPR subject-access-request workflow missing
- Data retention policy not visible in UI
- No way to export full user data dump
- Role-based data access not enforced in admin portal

---

## Sub-agent prompt template

```
You are Internal Admin Flow Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: The internal admin is a Roots employee responsible for ops, support,
moderation, or analytics. They care about speed, correctness, and audit
traceability. Mistakes here can affect every org on the platform, so the UI
should reward deliberate actions and discourage rash ones.

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
  1 — Critical: privacy/GDPR breach risk, destructive action without guardrail
  2 — High: support workflow blocked, data trust issue
  3 — Medium: UX polish, missing observability
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority.
```

---

## Report format

```
ROOTS INTERNAL ADMIN FLOW AUDIT
================================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Internal admin operations, support, moderation, analytics, audit

SUMMARY
-------
Total findings + P1-P5 counts

OPS GUARDRAILS — TOP RISKS
---------------------------
<3-5 findings where destructive actions lack safeguards>

GDPR / AUDIT GAPS
------------------
<any findings related to data traceability / compliance>

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
