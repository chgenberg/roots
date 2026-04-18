---
name: roots-club-member-flow-audit
description: >-
  Read-only audit of the B2B club member flow on Roots — the clubhouse admin
  or purchasing contact who places recurring wholesale orders. Eight parallel
  sub-agents each inspect one angle and produce a prioritized .txt report.
  Use when asked to review the club portal, recurring-order UX, or B2B buyer
  experience.
---

# Roots Club Member Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the club-member B2B flow — the
association purchasing contact who places recurring orders for the clubhouse,
gym, kiosk, or locker rooms. Eight sub-agents run in parallel and output a
single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files. This audit covers UX,
not payment rails / Fortnox / invoicing integration specifics.**

## When to use

- User asks to audit the club portal or club member flow
- User wants a review of B2B recurring-order UX
- User asks to improve the wholesale buyer experience

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/CLUB_MEMBER_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Club Dashboard & Overview

**Scope:** `apps/web/src/app/(club)/` landing, overview cards

Look for:
- Overview doesn't show the 3 things that matter: last order, next reorder, budget used
- Admin can't see who else on their team has placed orders
- No spend-to-date visualization
- Missing quick link to reorder last order
- Empty-state for brand new club is unhelpful
- No delivery / shipment tracking visible

### Agent 2 — Reorder Flow (Critical)

**Scope:** Order history, reorder button, favorites, "order again"

Look for:
- No one-click reorder from last order
- No favorites / saved baskets
- Reorder doesn't adjust for current prices / in-stock
- No subscription / scheduled reorder option
- Missing "due for reorder" reminder
- Order history pagination breaks for clubs with >50 orders

### Agent 3 — Product Browsing (B2B)

**Scope:** Catalog as seen by a club admin, bulk pricing, SKU search

Look for:
- No SKU / article search (B2B users paste SKUs from ERP)
- Bulk pricing tiers not visible ("10+ units = -15%")
- No unit-of-measure clarity (pieces, cartons, pallets)
- Min-order-quantity constraints unclear
- Can't browse by form (bottles, refills, travel-size) easily
- Missing data sheet / technical doc per product

### Agent 4 — Delivery & Address Management

**Scope:** Address book, delivery options, recurring ship-to

Look for:
- Can only have one saved address (clubs have multiple facilities)
- No per-address delivery notes ("leave at kiosk entrance")
- No PO number / reference field
- No split-shipment option
- Delivery windows / dates unclear
- Returns / exchanges flow absent from club portal

### Agent 5 — Invoice & History (Self-Service)

**Scope:** Invoice list, download, export, filtering

Look for:
- Invoices not downloadable as PDF
- No CSV export of all orders for internal accounting
- Missing year/quarter/month filtering
- No way to attach own PO document per order
- Invoice payment status not clearly visible
- No consolidated statement view

### Agent 6 — Account & User Management

**Scope:** Club user roles, add colleague, permissions

Look for:
- No way to add a second admin / delegate
- Role granularity missing (order placer vs approver vs view-only)
- No approval workflow for large orders
- Can't remove former colleague from the club
- Missing audit trail for who ordered what
- Login / SSO options too narrow for larger associations

### Agent 7 — Support & Account Manager Access

**Scope:** Support widget, account manager contact, docs, chat

Look for:
- No dedicated account manager surface (bigger clubs want this)
- Support contact generic, not personalized
- No "book a call with my rep" option
- Missing product-data-sheet / MSDS for kiosk storage
- Order issues have no clear escalation path
- AI assistant not trained on wholesale / reorder questions

### Agent 8 — Mobile Club Admin Experience

**Scope:** Club portal at 375px (admins re-order from the clubhouse phone)

Look for:
- Reorder flow requires desktop
- Order history table scrolls horizontally
- PDF invoice download broken on iOS Safari
- Critical buttons not in thumb zone
- Address book editing broken on mobile
- Bulk-add-to-cart not possible on mobile

---

## Sub-agent prompt template

```
You are Club Member Flow Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files. Do NOT evaluate payment integration
specifics (Fortnox, Klarna, invoicing rails) — that is OUT OF SCOPE.

Context: The club admin is typically 30-55 years old, managing the operational
side of a medium-to-large association. They value efficiency, reliability, and
predictable pricing. They often order from a phone in the clubhouse, but need
desktop-grade reports for board meetings.

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
  1 — Critical: blocks reorder, breaks trust, loses account
  2 — High: forces off-platform workaround, friction-heavy
  3 — Medium: UX polish
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority.
```

---

## Report format

```
ROOTS CLUB MEMBER FLOW AUDIT
=============================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: B2B club admin flow — reorder, invoices, account management
Out of scope: payment integration

SUMMARY
-------
Total findings + P1-P5 counts

REORDER FRICTION TOP ISSUES
----------------------------
<3-5 findings that slow down re-purchase>

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
- [ ] No payment-integration findings (out of scope)
