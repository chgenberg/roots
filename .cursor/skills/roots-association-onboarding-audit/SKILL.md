---
name: roots-association-onboarding-audit
description: >-
  Read-only audit of the association admin onboarding flow on Roots — from
  signup through first campaign launch. Eight parallel sub-agents each inspect
  one angle of the association-admin first-run experience and produce a
  prioritized .txt report. Use when asked to review the association
  registration, setup wizard, or first-campaign flow.
---

# Roots Association Onboarding Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the association-admin onboarding
path on Roots — the flow a chairperson, treasurer, or coach takes to register
their förening, set it up, and launch their first campaign. Eight sub-agents
work in parallel and output a single prioritized `.txt` report.

**CRITICAL: This skill is strictly read-only. Do NOT modify any source files,
configs, or dependencies. Only create the final report file.**

## When to use

- User asks to audit association / förening registration or setup
- User wants a review of the club/org onboarding wizard
- User asks to check the path to "first campaign launched"
- User wants to improve the first-run experience for association admins

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

Use the Task tool with `subagent_type: "explore"` and `readonly: true`. Launch
all 8 in a **single message** so they run concurrently.

### Step 2 — Collect and merge

Merge findings into one report sorted by priority. Deduplicate overlaps.

### Step 3 — Write report

```
docs/flow-audits/ASSOCIATION_ONBOARDING_<YYYY-MM-DD>_<HHMM>.txt
```

Create `docs/flow-audits/` if missing.

---

## The 8 agents

### Agent 1 — Signup & Account Creation

**Scope:** `apps/web/src/app/(auth)/`, signup routes, `apps/api/src/routes/auth.ts`

Look for:
- Too-long signup forms (ideal: email + password + org name only)
- Unclear org-type selection (idrott, kultur, skola, annat)
- Password policy not communicated upfront
- No social login / magic link option
- Missing email verification step or unclear confirmation
- Poor error messages ("Invalid input" vs specific field hints)

### Agent 2 — Onboarding Wizard / First Run

**Scope:** Portal layout, dashboard empty state, setup checklist

Look for:
- No visible progress ("3 of 5 steps" missing)
- Steps that can't be skipped but aren't critical
- Empty dashboard with no next-action nudge
- Missing "what should I do first?" guidance
- Checklist items without deep links to action
- No celebration / reward on completing setup

### Agent 3 — Organization Profile Setup

**Scope:** Org settings, org number, bankgiro, address, logo upload

Look for:
- Orgnummer not validated against Bolagsverket format
- Bankgiro / Plusgiro not validated
- Logo upload missing (crop, format hints, max size)
- Address autocomplete missing (friction)
- Org visibility / privacy options unclear
- No way to add multiple contact persons

### Agent 4 — Campaign Creation Flow

**Scope:** Campaign create routes, campaign settings, targets, dates

Look for:
- Too many fields in create-campaign form (split into steps)
- Target amount input unclear (SEK format, formatting hints)
- Date pickers that don't prevent past dates or unrealistic spans
- Missing campaign preview before publish
- No option to save draft
- Duplicate-campaign-from-template missing

### Agent 5 — Invitations to Team Leaders & Sellers

**Scope:** Invite flows, magic links, QR codes, bulk invite, email templates

Look for:
- Bulk invite missing (must add one-by-one)
- Invite link format unclear (no TTL, no single-use notice)
- No QR code for printed handouts
- Invite email copy generic / not on-brand
- No way to resend or revoke invites
- Missing list of pending vs accepted invites

### Agent 6 — First-Success Moment ("Aha")

**Scope:** Post-setup dashboard, first-seller-added state, first-order state

Look for:
- Nothing celebrates the first seller joining
- No nudge to share campaign externally after launch
- Missing "you've earned your first X SEK" notification
- First-week email sequence (if any) weak or absent
- No onboarding video or founder welcome message
- Dashboard doesn't visibly evolve as data arrives

### Agent 7 — Help & Self-Service

**Scope:** Help docs, tooltips, in-portal support, contact channels

Look for:
- No in-portal help center or FAQ
- Tooltips missing on complex fields (orgnummer, procent, kommission)
- Support link routes to email only (no chat, no AI)
- Missing "book a call" option for larger associations
- No getting-started video library
- Broken or outdated help links

### Agent 8 — Mobile Onboarding

**Scope:** All onboarding routes at 375px width, iPad at 768px

Look for:
- Wizard steps that break layout on mobile
- Multi-column forms that should stack
- File uploads that fail on mobile Safari
- Virtual keyboard covering submit buttons
- Step indicator that wraps or overflows
- Setup steps that require desktop-only interactions

---

## Sub-agent prompt template

```
You are Association Onboarding Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: This is a READ-ONLY audit. Do NOT modify any files.

Context: Roots serves Nordic föreningsliv. The user being onboarded is a
chairperson, coach, or treasurer of a local club (idrottsförening, skolklass,
scoutkår, musikskola, etc.). Many are 40-60 years old, non-technical, and
volunteering on evenings. The flow must be trustworthy, clear, and forgiving.

SCOPE:
{SCOPE}

CHECKLIST:
{CHECKLIST}

For each finding return:

FINDING: <one-line summary>
PRIORITY: <1-5>
FILE: <path>
LINE: <line or range>
DETAIL: <explanation + fix>

Priority scale:
  1 — Critical: blocks onboarding, GDPR/legal issue, data loss risk
  2 — High: significant friction, likely causes dropoff
  3 — Medium: UX polish, clarity gap
  4 — Low: minor tweak
  5 — Nice-to-have: delighter / future

Sort by priority. Be thorough — every step of the wizard, every form field.
```

---

## Report format

```
ROOTS ASSOCIATION ONBOARDING AUDIT
===================================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Association admin signup → first campaign launched

SUMMARY
-------
Total findings: <N>
  P1 / P2 / P3 / P4 / P5 counts

TOP DROPOFF RISKS
-----------------
<3-5 moments most likely to cause onboarding abandonment>

(then findings by priority)

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
