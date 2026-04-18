---
name: roots-seller-flow-audit
description: >-
  Read-only audit of the individual seller flow on Roots — the youth, parent,
  or member who receives an invite, sets up their personal shop, shares it,
  and sells. Eight parallel sub-agents each inspect one angle and produce a
  prioritized .txt report. Use when asked to review the seller experience,
  personal shop page, sharing flow, or seller dashboard.
---

# Roots Seller Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the individual seller flow on
Roots. The seller is typically a youth athlete, a parent selling on behalf of
their child, or an association member. They must go from invite-received to
first-sale with minimum friction. Eight sub-agents run in parallel and output
a single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files.**

## When to use

- User asks to audit the seller flow, personal shop, or share flow
- User wants a review of the seller dashboard or motivation layer
- User asks to improve the path from invite → first sale

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/SELLER_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Invite Acceptance & Signup

**Scope:** Invite token flow, signup via invite link, child/parent consent

Look for:
- Invite link opens but requires re-login unexpectedly
- Expired link UX is a dead end (no way to request new)
- Parent-child consent flow unclear (who signs? whose email?)
- Too much information requested upfront (ask name + email only)
- No preview of what they're joining before they commit
- Missing "this is a real invitation from Coach X" trust cue

### Agent 2 — Personal Shop Page Setup

**Scope:** Seller profile creation, photo upload, personal message, shop URL

Look for:
- Personal message field missing or not prominent
- No photo upload, or photo upload too complex for a 12-year-old
- Shop URL slug auto-generated ugly (/s/abc123) instead of `/s/johan`
- No preview of how the shop will look to supporters
- Can't change name / photo later
- Missing templates / suggestions for personal message

### Agent 3 — First Share Experience

**Scope:** Share flow — native share, copy link, QR, social pre-fill

Look for:
- Native Web Share API not wired up (must copy-paste manually)
- No QR code for printed flyers or stickers
- Share copy not pre-filled (seller must write their own)
- Missing direct channel buttons (WhatsApp, Messenger, SMS, Instagram DM)
- Share preview (Open Graph image) missing seller name / photo
- First-share celebration absent (should nudge a second share)

### Agent 4 — Seller Dashboard Clarity

**Scope:** Seller dashboard post-first-login

Look for:
- Unclear what the seller should do right now (ambiguous CTAs)
- Total sold not the largest element on the page
- Commission/earnings formula unclear
- No "next milestone X sales away" nudge
- Activity feed missing ("Anna just bought 2 items!")
- No way to see who bought (if GDPR-permitted and parent-controlled)

### Agent 5 — Share Assets & Content

**Scope:** Share assets, image templates, copy templates, video scripts

Look for:
- No library of pre-made share images / stories
- Copy templates missing or generic
- No seasonal / campaign-themed variants
- Share images not customized with seller's name / team
- Missing tips for "how to sell to grandparents" vs "school friends"
- No video script or TikTok template for older youth

### Agent 6 — Motivation & Gamification

**Scope:** Progress bars, milestones, badges, nudges, notifications

Look for:
- No progress bar toward a personal goal
- Milestones missing or too far apart (first milestone should be at 1 sale)
- Notifications absent or annoying
- No peer comparison (opt-in) for teens who want it
- Missing daily/weekly streak mechanics
- No celebration animation on sale

### Agent 7 — Parent/Guardian Oversight & Safety

**Scope:** Parent role, child-safety, GDPR for minors

Look for:
- No parent-of-seller view (parent wants to help 10-year-old)
- Child's data (full name, school, photo) too exposed publicly
- No opt-out of public leaderboard
- Missing age-gate on signup (GDPR under-13 / under-16)
- Marketing emails to minors without parent consent
- Direct messaging to sellers not moderated

### Agent 8 — Mobile-First Seller Experience

**Scope:** All seller routes at 375px — the seller IS on a phone

Look for:
- Share button not fixed-bottom on mobile
- Personal shop URL too long to share in SMS
- Dashboard cards that wrap awkwardly
- Photo upload via phone camera broken or slow
- Portrait video not supported in share assets
- Notifications rely on desktop browser (not push-capable)

---

## Sub-agent prompt template

```
You are Seller Flow Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: The seller is often a 10-17 year old Swedish youth, sometimes assisted
by a parent. They are mobile-native, short-attention, and highly sensitive to
how things "feel" socially. The flow must feel fun, proud, and safe — not
corporate or transactional. Privacy is paramount for minors.

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
  1 — Critical: child-safety / GDPR violation, broken core seller flow
  2 — High: friction blocking first sale, motivation killer
  3 — Medium: UX polish, clarity
  4 — Low: minor tweak
  5 — Nice-to-have: delighter

Sort by priority. Check EVERY screen on mobile.
```

---

## Report format

```
ROOTS SELLER FLOW AUDIT
========================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Seller invite → first share → first sale → ongoing

SUMMARY
-------
Total findings + P1-P5 counts

CHILD SAFETY / GDPR RED FLAGS
------------------------------
<any P1 items related to minor-safety>

FIRST-SALE ACCELERATORS
------------------------
<3-5 changes that would measurably reduce time-to-first-sale>

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
