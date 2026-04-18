---
name: roots-conversion-trust-audit
description: >-
  Read-only audit of conversion psychology, trust signals, social proof,
  retention, gamification ethics, and brand-voice consistency across every
  role on Roots. Eight parallel sub-agents each inspect one angle and produce
  a prioritized .txt report. Use when asked to review conversion, trust,
  persuasion design, or cross-role narrative consistency.
---

# Roots Conversion & Trust Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the persuasion, trust, retention,
and narrative layer across every role on Roots — public visitor, association
admin, team leader, seller, supporter, club admin, sales rep, internal admin.
This audit looks at the *why-it-converts* layer on top of the raw UX. Eight
sub-agents run in parallel and output a single prioritized `.txt` report.

**CRITICAL: Strictly read-only. Do NOT modify files. This audit evaluates
persuasion ethically — dark patterns are automatic P1 findings.**

## When to use

- User asks to audit conversion, trust, or persuasion design
- User wants a cross-role review of brand voice and narrative
- User asks to find dark patterns or gamification that shames users
- User wants to see where retention and re-engagement leak

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

`subagent_type: "explore"`, `readonly: true`, one message.

### Step 2 — Merge and dedupe

### Step 3 — Write report

```
docs/flow-audits/CONVERSION_TRUST_<YYYY-MM-DD>_<HHMM>.txt
```

---

## The 8 agents

### Agent 1 — Trust Signals

**Scope:** Every public and logged-in surface — certifications, press, org info

Look for:
- Missing organisation number / VAT / address on footer
- No visible press / award mentions
- Certifications (GDPR, environmental, ingredient) invisible
- No "meet the team" / founders / chemist page
- Contact info hidden or generic
- No physical address / Nordic-origin signal

### Agent 2 — Social Proof

**Scope:** Testimonials, numbers, case studies, seller leaderboards

Look for:
- Stats without sources ("used by 10,000 associations" — where from?)
- Testimonials without full names, photos, affiliations
- Fake-looking reviews (too polished, no criticism)
- No case studies with real amounts raised
- Missing "X associations joined this week" live signal
- Social proof asymmetric (only on marketing, absent in portals)

### Agent 3 — Urgency & Scarcity (Ethical)

**Scope:** Countdowns, stock counters, deadlines, campaign end dates

Look for:
- Fake urgency ("only 2 left!" when stock is 500)
- Countdown that resets on refresh
- Artificial deadlines not tied to real campaign dates
- Missing urgency on real deadlines (campaign ending is real urgency)
- Scarcity messaging that shames users
- No clear honest time-boxed CTA

### Agent 4 — Gamification Ethics

**Scope:** Badges, streaks, leaderboards, milestones across roles

Look for:
- Leaderboards that shame low performers by default
- Streak mechanics that exploit loss-aversion in kids
- Badges impossible to earn (demotivating)
- Public rank of minors without parent consent
- Points/coins currency that implies gambling
- No opt-out of gamification layer

### Agent 5 — Onboarding Retention (First 7 Days)

**Scope:** First-week experience across all roles

Look for:
- No Day-1, Day-3, Day-7 email sequence
- In-app re-engagement prompts absent after first login
- First-success moment not celebrated
- "What's next" nudges missing after each completed step
- Abandoned signup recovery missing
- Returning-user welcome-back experience absent

### Agent 6 — Re-Engagement & Winback

**Scope:** Email / push / in-app for dormant users

Look for:
- No winback campaign for dormant associations
- No re-order nudge for club admins past their cycle
- Seller stopped sharing → no gentle nudge
- Campaign ended → no "start a new one" prompt
- Expired quote → no sales-rep reminder
- No "we miss you" with actual value (not just pleading)

### Agent 7 — Viral & Referral Mechanics

**Scope:** Share flows, refer-a-friend, seller link mechanics

Look for:
- Sharing requires too many steps (not native Web Share)
- No refer-an-association mechanic
- Supporter after purchase not invited to start their own campaign
- Share content not customized per channel (WhatsApp vs IG vs SMS)
- No "share progress" prompt at milestones
- Missing Open Graph preview on shared links

### Agent 8 — Brand Voice & Narrative Consistency

**Scope:** Copy across public, portal, emails, errors, AI — all roles

Look for:
- Inconsistent tone between marketing site and logged-in portal
- Swenglish / Nordic voice leaking into English or vice-versa
- Error messages cold or corporate when brand is warm
- AI chatbot tone doesn't match brand voice
- Email templates generic transactional
- Notification copy inconsistent (sometimes cheerful, sometimes terse)

---

## Sub-agent prompt template

```
You are Conversion & Trust Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: READ-ONLY. Do NOT modify files.

Context: Roots is a Nordic föreningsliv commerce platform. The brand promise
is trust, community, and honest earnings. Persuasion must be ETHICAL —
dark patterns, fake urgency, shame-based gamification, or non-consensual
public ranking of minors are always Priority 1 findings. The tone is warm,
calm, Nordic — never high-pressure or American-sales.

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
  1 — Critical: dark pattern, fake signals, minor-safety breach, trust violation
  2 — High: missing trust signal where it materially affects conversion
  3 — Medium: tone drift, inconsistent narrative
  4 — Low: minor copy tweak
  5 — Nice-to-have: future enhancement

Dark patterns are ALWAYS Priority 1.

Sort by priority. Be brutally honest — this audit is the brand's conscience.
```

---

## Report format

```
ROOTS CONVERSION & TRUST AUDIT
===============================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Persuasion, trust, social proof, retention, gamification, brand voice
Ethic: dark patterns are automatic P1 findings

SUMMARY
-------
Total findings + P1-P5 counts

DARK PATTERNS / ETHICAL RED FLAGS (AUTO-P1)
--------------------------------------------
<every pattern that manipulates rather than persuades>

TRUST GAPS — TOP 5
-------------------
<5 missing trust signals with the biggest conversion impact>

RETENTION LEAKS — TOP 5
------------------------
<5 moments where users silently fall off>

(findings by priority)

--- END OF REPORT ---
```

---

## Checklist before finishing

- [ ] All 8 agents completed
- [ ] Findings deduplicated
- [ ] Priority-tagged 1-5
- [ ] Dark patterns flagged as P1
- [ ] Sorted by priority
- [ ] Saved in `docs/flow-audits/`
- [ ] No source files modified
