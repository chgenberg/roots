---
name: roots-supporter-checkout-audit
description: >-
  Read-only audit of the supporter / end-buyer flow on Roots — the friend,
  grandparent, or neighbour who lands on a seller's personal shop and buys.
  Focus on UX, trust, and conversion only (NOT payment integration). Eight
  parallel sub-agents each inspect one angle and produce a prioritized .txt
  report. Use when asked to review the supporter checkout UX or personal shop
  conversion flow.
---

# Roots Supporter Checkout Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the supporter flow — when an
external buyer (a friend, grandparent, neighbour, colleague) clicks a seller's
shared link, lands on their personal shop, and completes a purchase. This
audit covers **UX, messaging, trust and conversion only** — not payment
integration or Fortnox, which are out of scope.

**CRITICAL: Strictly read-only. Do NOT modify files. Do NOT evaluate payment
integration specifics (Klarna, Stripe, invoicing, Fortnox) — that is
deliberately excluded.**

## When to use

- User asks to audit the buyer / supporter checkout experience
- User wants a review of the personal shop landing page
- User asks about cart UX, post-purchase UX, or share-back flow

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/SUPPORTER_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Seller Page Landing

**Scope:** `/s/[slug]` personal shop page — first impression

Look for:
- Seller's name / photo not clearly visible (the personal touch is the magic)
- Association / team / cause context missing or buried
- "Why I'm selling" narrative absent
- Seller's progress bar not visible
- No seller photo fallback (initials avatar) for shy sellers
- Page feels generic, not personal

### Agent 2 — Product Browsing

**Scope:** Product list on personal shop, product cards, detail pages

Look for:
- Products not visually appealing (weak imagery, cropped wrong)
- Product copy generic (no "this supports F12-laget" context)
- Missing ingredients / details relevant to skincare buyers
- Inconsistent price formatting
- No product filtering / sorting when catalog is large
- Missing related-products nudge

### Agent 3 — Cart UX

**Scope:** Cart components, cart drawer, add-to-cart flow

Look for:
- Add-to-cart doesn't give visible confirmation
- Cart doesn't persist across page reloads
- Quantity controls poorly sized on mobile
- Remove item UX destructive without confirm
- No "you're supporting [seller] / [association]" reminder in cart
- Price breakdown not transparent (shipping, moms)

### Agent 4 — Checkout Flow UX

**Scope:** Checkout form, address, contact, delivery options — UX only, not payment

Look for:
- Too many steps (should be 1-2 pages max for low-ticket support)
- Address autocomplete missing (Swedish postnummer → city fill)
- Email validation too aggressive, rejects + aliases
- Phone format not Nordic-friendly
- Delivery options unclear (to seller? to buyer? pickup at school?)
- No guest checkout path

### Agent 5 — Trust Signals in Checkout

**Scope:** Checkout page, security cues, seller attribution visible

Look for:
- No reassurance this is a legitimate association campaign
- Missing "100% goes to [team]" or exact-percentage transparency
- No org number / association info visible at checkout
- Missing support contact if something goes wrong
- No return policy / consumer rights (konsumentköplagen) visible
- Unclear what the seller sees vs. what the association sees

### Agent 6 — Post-Purchase UX

**Scope:** Thank-you page, confirmation email, share-back flow

Look for:
- Thank-you page generic, doesn't thank the supporter personally
- No share-back ("tell others you supported [seller]") CTA
- Confirmation email missing or plain-text ugly
- No celebration / progress update shown ("[Seller] is now 60% to their goal!")
- Receipt not downloadable / printable
- No follow-up mechanism (save email for next campaign, opt-in)

### Agent 7 — Error & Edge Cases

**Scope:** Out-of-stock, sold-out, campaign ended, invalid seller slug

Look for:
- Out-of-stock shows unclear error
- Expired campaign page gives no redirect to another active seller / cause
- Invalid seller slug returns a generic 404 instead of a helpful page
- Cart that holds invalid items doesn't auto-repair
- Network error at checkout loses entered data
- No offline / slow-network fallback messaging

### Agent 8 — Mobile Checkout (Critical Path)

**Scope:** Full supporter flow at 375px — the majority of supporters are on phone

Look for:
- Product images that don't swipe on touch
- Add-to-cart button below fold on product page
- Checkout form fields zooming the viewport (iOS font-size < 16px)
- Virtual keyboard covering submit button
- One-handed reach: critical buttons top of screen instead of bottom
- Share-back buttons missing on mobile thank-you

---

## Sub-agent prompt template

```
You are Supporter Checkout Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files. Do NOT evaluate payment integration
(Klarna / Stripe / Fortnox / invoice rails) — that is OUT OF SCOPE for this
audit.

Context: The supporter is typically a parent, grandparent, aunt/uncle, or
family friend of the seller. They're buying out of social support and trust in
the association, not because they searched for skincare. Average ticket is
low (100-500 SEK). They want to help quickly and get on with their day.

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
  1 — Critical: broken checkout UX, trust violation, dead-end page
  2 — High: causes cart abandonment, breaks seller attribution
  3 — Medium: UX polish, clarity
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority. ALWAYS check mobile (375px).
```

---

## Report format

```
ROOTS SUPPORTER CHECKOUT AUDIT
===============================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Seller link click → product → cart → checkout UX → thank-you
Out of scope: payment integration (Klarna, Stripe, Fortnox, invoicing)

SUMMARY
-------
Total findings + P1-P5 counts

CART ABANDONMENT TOP RISKS
---------------------------
<3-5 findings most likely to cause abandonment>

SELLER ATTRIBUTION ISSUES
--------------------------
<any finding where the seller's identity is not preserved through checkout>

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
- [ ] No payment-integration findings included (explicitly out of scope)
