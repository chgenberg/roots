---
name: roots-team-leader-flow-audit
description: >-
  Read-only audit of the team leader / coach experience on Roots — inviting
  sellers, tracking progress, and managing a team campaign. Eight parallel
  sub-agents each inspect one angle and produce a prioritized .txt report.
  Use when asked to review the team leader portal, coach flow, or mid-tier
  management UX.
---

# Roots Team Leader Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the team leader experience — the
coach or parent rep who runs a sub-team within an association campaign
(e.g. "F12-laget" inside "IFK Göteborg"). Eight sub-agents run in parallel and
output a single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files.**

## When to use

- User asks to audit the team leader / coach flow
- User wants a review of team management, invitations, or leaderboards
- User asks to improve the mid-tier role between association admin and seller

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

Use `subagent_type: "explore"`, `readonly: true`, all in one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/TEAM_LEADER_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Team Dashboard & Overview

**Scope:** Team leader landing, team overview, KPI cards

Look for:
- Overview doesn't show the 3 metrics that matter: total sold, sellers active, days left
- Stale data with no "last updated" indicator
- Too many secondary widgets burying the primary stats
- No quick actions (invite, nudge, message) from the top of the dashboard
- Missing comparison ("+12% vs last week")
- Empty-state when team has no sellers is discouraging, not inviting

### Agent 2 — Seller Invitation Flow

**Scope:** Invite seller flows — bulk, single, QR, printable, SMS

Look for:
- No bulk paste-list invite (20 sellers one-by-one = painful)
- No QR code to print for a team meeting
- Invite SMS option missing (coaches use SMS groups)
- Parent-of-child invitation model unclear (who signs up, child or parent?)
- Invite expiry / revoke UX missing
- Invite tracker doesn't show who hasn't opened the email

### Agent 3 — Seller Progress Monitoring

**Scope:** Seller list, individual seller drill-in, activity feed

Look for:
- Leaderboard exposing kids' real names publicly (privacy/safety)
- No way to see "who hasn't sold anything yet" to follow up
- Missing per-seller drill-down (orders, revenue, most active day)
- Activity feed not chronological or missing key events
- No way to export seller progress for a team meeting
- Sellers can't be grouped (e.g. by age, squad, grade)

### Agent 4 — Team Communication

**Scope:** Messaging, announcements, reminders

Look for:
- No way to send a message to the whole team from the portal
- Reminder scheduling absent ("Remind non-starters in 3 days")
- Announcement banner feature missing
- No integration with external channels (Laget.se, email group)
- Missing template library ("Welcome", "Last week push", "Thanks")
- No read receipts or delivery confirmation

### Agent 5 — Recognition & Motivation

**Scope:** Seller grades, badges, milestones, celebrations

Look for:
- No recognition mechanism (badges, levels, milestones)
- Grades/badges that shame low performers instead of celebrating effort
- Missing "team milestone unlocked" events
- No sharable celebration cards
- Recognition not visible to parents
- No way for coach to personally thank a seller

### Agent 6 — Reports & Exports

**Scope:** Report generation, CSV/PDF export, tax documentation

Look for:
- No end-of-campaign report for team leader to share with parents
- CSV exports missing or broken
- Reports lack per-seller breakdown useful for payouts
- No printable summary for the next board meeting
- Missing date-range filtering
- Reports don't cite currency / include org branding

### Agent 7 — Edge Cases & Handling Problems

**Scope:** Seller dropout, refund requests, duplicate accounts, data corrections

Look for:
- No way to mark a seller as inactive without deleting their data
- Can't correct a wrongly entered seller name
- Duplicate-seller detection absent
- Refund / cancellation flow unclear for team leader role
- No escalation path to association admin
- Missing audit log for sensitive team-leader actions

### Agent 8 — Mobile Coach Experience

**Scope:** Team leader portal at 375px (coaches often on the sideline / phone)

Look for:
- Dashboard cards that don't reflow on mobile
- Bulk invite impossible on mobile
- Seller list table that scrolls horizontally instead of stacking
- Key actions hidden behind extra taps
- Notifications / push not supported for coaches on the go
- Printable QR code flow broken on mobile

---

## Sub-agent prompt template

```
You are Team Leader Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: The team leader is often a parent volunteer, coaching 10-30 kids/teens
in a Swedish förening. They are time-poor, often using the phone between
practices. Their role is to invite sellers, nudge stragglers, celebrate wins,
and report back to the board.

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
  1 — Critical: breaks team management, privacy risk (e.g. kids' data)
  2 — High: causes coach frustration, team undersells
  3 — Medium: UX polish / clarity
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority. Be thorough.
```

---

## Report format

```
ROOTS TEAM LEADER FLOW AUDIT
=============================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Team leader / coach experience end-to-end

SUMMARY
-------
Total findings + P1-P5 counts

COACH-ON-SIDELINE QUICK WINS
----------------------------
<3-5 top mobile / time-poor fixes>

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
