---
name: roots-public-flow-audit
description: >-
  Read-only audit of the entire logged-out / public visitor flow on Roots —
  from landing to lead capture and signup. Eight parallel sub-agents each
  inspect one angle of the public experience and produce a prioritized .txt
  report. Use when asked to review the public site, marketing funnel, lead
  magnet flow, or first-time visitor experience.
---

# Roots Public Flow Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the logged-out public flow on
Roots. Eight sub-agents each inspect one angle of the first-time visitor
experience in parallel. Findings are merged into a single prioritized `.txt`
report.

**CRITICAL: This skill is strictly read-only. Do NOT modify any source files,
configs, or dependencies. Only create the final report file.**

## When to use

- User asks to audit the public / marketing / unlogged experience
- User wants a review of the first-time visitor funnel
- User asks to scan conversion, lead magnet, or landing flows
- User wants to improve the first impression of Roots

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

Use the Task tool with `subagent_type: "explore"` and `readonly: true` for each
agent. Launch all 8 in a **single message** so they run concurrently.

### Step 2 — Collect and merge

Merge findings into one report sorted by priority. Deduplicate overlapping
findings across agents.

### Step 3 — Write report

Save a single `.txt` file to:

```
docs/flow-audits/PUBLIC_<YYYY-MM-DD>_<HHMM>.txt
```

Create the `docs/flow-audits/` directory if it does not exist.

---

## The 8 agents

### Agent 1 — First Impression & Hero

**Scope:** `apps/web/src/app/(marketing)/page.tsx`, hero components, above-the-fold

Look for:
- Unclear value proposition in the first 3 seconds
- Missing or weak primary CTA above the fold
- Hero visuals that don't communicate "föreningsliv" / Nordic nature
- Long load times for hero image/video
- Text that fails Swedish 9-year-old readability test
- Missing social proof near the hero (logos, member count, press)

### Agent 2 — Information Architecture & Menu

**Scope:** `apps/web/src/components/header.tsx`, marketing routes under `app/(marketing)/`

Look for:
- Menu labels that hide the core offer ("Så fungerar det", "Produkter")
- Missing direct path to "Starta förening-kampanj"
- Too many top-level items (>6 = cognitive overload)
- Footer that duplicates or contradicts the main menu
- Broken or dead-end links inside marketing flow
- Breadcrumbs missing on sub-pages

### Agent 3 — Value Proposition & Messaging

**Scope:** All marketing page copy under `app/(marketing)/`

Look for:
- Jargon or internal language leaking into customer-facing copy
- Missing "for whom / for what / how it works" at page level
- Benefit-vs-feature imbalance (too feature-heavy)
- Inconsistent tone between pages
- Missing Swedish-first copy (or Swenglish)
- No clear differentiator vs. other fundraising/sales platforms

### Agent 4 — Trust & Social Proof

**Scope:** Testimonial components, press sections, partner logos, about-us

Look for:
- No testimonials, or placeholder/fake testimonials
- Missing press mentions or awards
- No founder story / "varför Roots" narrative
- Missing certifications, organization number, VAT
- No photos of real people / real associations
- Missing links to social channels with activity proof

### Agent 5 — Lead Capture & Forms

**Scope:** Contact forms, booking widgets, newsletter signup, `/kontakt`

Look for:
- Forms with too many required fields (friction)
- Missing success/error states
- No confirmation email promised or delivered
- Forms not usable with keyboard / screen reader
- Phone/email validation too strict or missing
- Missing "what happens next" expectation after submit

### Agent 6 — Mobile Public Experience

**Scope:** All marketing pages viewed at 375px width

Look for:
- Hero that breaks or crops badly on small screens
- CTAs below the thumb zone
- Horizontal scroll on any page
- Type that shrinks below 16px body
- Menu hamburger that hides critical actions
- Tap targets smaller than 44x44px

### Agent 7 — Accessibility (Public)

**Scope:** Marketing pages, focus states, color contrast

Look for:
- Missing alt text on marketing imagery
- Color contrast below WCAG AA on brand colors
- Decorative elements announced to screen readers
- Focus order that skips critical CTAs
- Reduced-motion preferences not respected
- Missing skip-to-content link on public pages

### Agent 8 — SEO & Discoverability

**Scope:** `apps/web/src/app/(marketing)/`, `sitemap.ts`, `robots.ts`, JSON-LD

Look for:
- Missing or duplicate page titles / descriptions
- No Open Graph / Twitter card metadata
- Missing structured data (Organization, Product, FAQ)
- No canonical URLs on paginated or UTM pages
- Sitemap missing pages or listing private ones
- Weak H1/H2 hierarchy for search

---

## Sub-agent prompt template

```
You are Public Flow Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: This is a READ-ONLY audit. Do NOT modify any files.

Your job is to thoroughly inspect the Roots public / logged-out flow in your
specific domain.

SCOPE:
{SCOPE}

CHECKLIST — Look for these specific issues:
{CHECKLIST}

Context: Roots is a Nordic föreningsliv (association-life) commerce platform
serving clubs, teams, and sports associations in Sweden. The public flow must
convert parents, coaches, and association board members into signups.

For each finding, return:

FINDING: <one-line summary>
PRIORITY: <1-5, where 1 = critical/blocking, 5 = nice-to-have>
FILE: <file path>
LINE: <line number or range, if applicable>
DETAIL: <2-3 sentence explanation + suggested fix>

Priority scale:
  1 — Critical: blocks conversion, legal/GDPR issue, broken core flow
  2 — High: significant friction, trust-breaking issue
  3 — Medium: UX polish, messaging gap, accessibility issue
  4 — Low: minor inconsistency, copy tweak
  5 — Nice-to-have: future enhancement, ambitious idea

Return ALL findings sorted by priority. Be thorough — every page, every CTA.
If an area is clean, note it briefly.
```

---

## Report format

```
ROOTS PUBLIC FLOW AUDIT
=======================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Logged-out visitor flow — marketing, landing, lead capture

SUMMARY
-------
Total findings: <N>
  Priority 1 (Critical):  <count>
  Priority 2 (High):      <count>
  Priority 3 (Medium):    <count>
  Priority 4 (Low):       <count>
  Priority 5 (Nice):      <count>

TOP 5 QUICK WINS
----------------
<5 findings that are low effort / high impact>

=====================================================
PRIORITY 1 — CRITICAL
=====================================================
[1.1] <finding>
Agent: <name>
File: <path>
Line: <line>
Detail: <explanation>

... (repeat by priority) ...

--- END OF REPORT ---
```

---

## Checklist before finishing

- [ ] All 8 agents completed
- [ ] Findings deduplicated across agents
- [ ] All findings priority-tagged 1-5
- [ ] Report sorted by priority
- [ ] Report saved as `.txt` in `docs/flow-audits/`
- [ ] No source files modified
