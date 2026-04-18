---
name: roots-platform-audit
description: >-
  Read-only audit of the entire Roots platform using 8 parallel sub-agents.
  Finds bugs, UX issues, security gaps, and improvement opportunities across
  frontend, backend, auth, AI, commerce, and DevOps. Produces a prioritized
  report as a .txt file. Use when asked to audit, review, or scan the platform
  for issues, or when asked to generate a site health report.
---

# Roots Platform Audit — 8-Agent Sweep

## Purpose

Run a comprehensive, **read-only** audit of the Roots monorepo. Eight sub-agents
each inspect one domain in parallel. Findings are collected into a single
prioritized `.txt` report saved to the project root.

**CRITICAL: This skill is strictly read-only. Do NOT modify any source files,
configs, or dependencies. Only create the final report file.**

## When to use

- User asks to "audit", "scan", "review", or "check" the platform
- User wants a bug hunt or quality report
- User wants a health check before a release or demo
- User asks for improvement suggestions across the codebase

## Workflow

### Step 1 — Launch 8 sub-agents in parallel

Use the Task tool with `subagent_type: "explore"` and `readonly: true` for each
agent. Launch all 8 in a **single message** so they run concurrently.

Each agent receives:
- Its domain scope (files/directories to inspect)
- The matching strategy doc from `docs/composer-agents/` as reference
- The audit checklist below
- Instructions to return structured findings

### Step 2 — Collect and merge

When all agents return, merge their findings into one report sorted by priority.

### Step 3 — Write report

Save a single `.txt` file to the project root:

```
docs/platform-audit/AUDIT_<YYYY-MM-DD>_<HHMM>.txt
```

Create the `docs/platform-audit/` directory if it does not exist.

---

## The 8 agents

### Agent 1 — UX, IA & Navigation

**Scope:** `apps/web/src/app/`, `apps/web/src/components/`, layout files, nav
**Reference:** `docs/composer-agents/01_UX_IA_NAVIGATION.txt`

Look for:
- Broken or missing links / routes
- Navigation inconsistencies (mobile vs desktop)
- Missing loading states, error boundaries, empty states
- Accessibility gaps (missing alt text, aria labels, focus traps)
- CTA clarity and placement issues
- Pages missing metadata (title, description)

### Agent 2 — Visual Design & Motion

**Scope:** `apps/web/src/app/globals.css`, component styles, Tailwind config
**Reference:** `docs/composer-agents/02_VISUAL_DESIGN_MOTION.txt`

Look for:
- Hardcoded colors instead of semantic tokens
- Dark mode contrast issues (white-on-white, unreadable text)
- Inconsistent border-radius, spacing, or typography
- CSS animations that should use Remotion/frame-based approach
- Missing hover/focus states on interactive elements
- Brand consistency violations (colors outside the palette)

### Agent 3 — Frontend Stack

**Scope:** `apps/web/`, `packages/ui/`, `next.config.ts`, `tsconfig.json`
**Reference:** `docs/composer-agents/03_FRONTEND_STACK.txt`

Look for:
- TypeScript errors or `any` casts
- Missing `"use client"` / `"use server"` directives
- Large bundle imports (entire libraries vs tree-shaken)
- Unused imports or dead code
- Missing error boundaries
- Images not using `next/image`
- Performance issues (unnecessary re-renders, missing memoization)

### Agent 4 — Backend, API & Data

**Scope:** `apps/api/src/`, `packages/db/src/schema/`, `packages/contracts/`
**Reference:** `docs/composer-agents/04_BACKEND_API_DATA.txt`

Look for:
- Missing input validation on endpoints
- SQL injection risks (raw SQL without parameterization)
- Missing error handling (unhandled promise rejections)
- N+1 query patterns
- Schema inconsistencies (nullable vs required mismatches)
- Missing database indexes for common queries
- API endpoints without proper error responses

### Agent 5 — Auth & RBAC

**Scope:** `apps/api/src/routes/auth.ts`, `apps/api/src/trpc/middleware/`,
`apps/web/src/middleware.ts`, session/cookie code
**Reference:** `docs/composer-agents/05_AUTH_RBAC.txt`

Look for:
- Routes missing authentication checks
- Role checks only in frontend (not enforced in backend)
- Session handling issues (missing expiry, insecure cookies)
- Password handling problems
- CSRF protection gaps
- Privilege escalation paths (e.g. seller accessing team-leader routes)

### Agent 6 — AI & Open Claw

**Scope:** `apps/api/src/routes/` (AI-related), `apps/web/src/components/chat-widget.tsx`,
any OpenAI/LLM integration code
**Reference:** `docs/composer-agents/06_AI_OPENCLAW.txt`

Look for:
- API keys exposed to browser/client
- Missing rate limiting on AI endpoints
- Prompt injection vulnerabilities
- Streaming response handling issues
- Missing error handling for LLM failures
- Token/cost controls

### Agent 7 — Fortnox & Commerce

**Scope:** `apps/api/src/routes/checkout.ts`, order/invoice code,
Fortnox integration, Klarna integration
**Reference:** `docs/composer-agents/07_FORTNOX_COMMERCE.txt`

Look for:
- Payment handling edge cases (double charges, missing refund paths)
- Order state machine gaps
- Missing webhook signature verification
- Price calculation errors (ore vs SEK confusion)
- Missing Fortnox abstraction layer
- Inventory/stock handling issues

### Agent 8 — Security, DevOps & SEO

**Scope:** `Dockerfile`, `.github/workflows/`, `next.config.ts` (headers),
`robots.ts`, `sitemap.ts`, `apps/web/src/app/layout.tsx`
**Reference:** `docs/composer-agents/08_SECURITY_DEVOPS_SEO.txt`

Look for:
- Missing or weak security headers (CSP, HSTS, X-Frame-Options)
- Secrets in code or committed env files
- CI/CD pipeline gaps (missing steps, no caching)
- Docker build inefficiencies
- SEO issues (missing Open Graph, structured data, canonical URLs)
- Missing robots.txt rules for private routes
- Performance: missing compression, caching headers

---

## Sub-agent prompt template

Use this template for each agent's `prompt` parameter (fill in `{AGENT_NUMBER}`,
`{AGENT_NAME}`, `{SCOPE}`, and `{CHECKLIST}`):

```
You are Audit Agent {AGENT_NUMBER}: {AGENT_NAME}.

IMPORTANT: This is a READ-ONLY audit. Do NOT modify any files.

Your job is to thoroughly inspect the Roots monorepo for issues in your domain.

SCOPE — Files and directories to inspect:
{SCOPE}

REFERENCE — Read this strategy doc first for context:
docs/composer-agents/{REFERENCE_FILE}

CHECKLIST — Look for these specific issues:
{CHECKLIST}

For each finding, return it in this exact format:

FINDING: <one-line summary>
PRIORITY: <1-5, where 1 = critical/blocking, 5 = nice-to-have>
FILE: <file path>
LINE: <line number or range, if applicable>
DETAIL: <2-3 sentence explanation of the issue and suggested fix>

Priority scale:
  1 — Critical: security vulnerability, data loss risk, broken core flow
  2 — High: bug affecting users, auth bypass, incorrect data
  3 — Medium: UX issue, missing validation, inconsistency
  4 — Low: code quality, minor UI polish, missing optimization
  5 — Nice-to-have: suggestion, enhancement idea, future improvement

Return ALL findings sorted by priority (1 first). Aim for thoroughness — check
every file in your scope. If an area is clean, note that briefly.
```

---

## Report format

The final `.txt` report should follow this structure:

```
ROOTS PLATFORM AUDIT
====================
Date: <YYYY-MM-DD HH:MM>
Agents: 8 parallel sub-agents
Scope: Full monorepo (apps/web, apps/api, packages/*)

SUMMARY
-------
Total findings: <N>
  Priority 1 (Critical):  <count>
  Priority 2 (High):      <count>
  Priority 3 (Medium):    <count>
  Priority 4 (Low):       <count>
  Priority 5 (Nice):      <count>

=====================================================
PRIORITY 1 — CRITICAL
=====================================================

[1.1] <finding summary>
Agent: <agent name>
File: <path>
Line: <line>
Detail: <explanation>

... (repeat for all P1 findings)

=====================================================
PRIORITY 2 — HIGH
=====================================================

... (same format)

=====================================================
PRIORITY 3 — MEDIUM
=====================================================

... (same format)

=====================================================
PRIORITY 4 — LOW
=====================================================

... (same format)

=====================================================
PRIORITY 5 — NICE TO HAVE
=====================================================

... (same format)

=====================================================
CLEAN AREAS (no issues found)
=====================================================

- <area>: <brief note>

--- END OF REPORT ---
```

---

## Checklist before finishing

- [ ] All 8 agents completed and returned findings
- [ ] Findings are deduplicated (same issue found by multiple agents = one entry)
- [ ] All findings have a priority 1-5
- [ ] Report is sorted by priority (1 first)
- [ ] Report saved as `.txt` in `docs/platform-audit/`
- [ ] No source files were modified
