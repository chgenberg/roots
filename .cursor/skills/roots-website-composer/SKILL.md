---
name: roots-website-composer
description: >-
  Build the Roots Nordic B2B2C website (3 products, club + sales portals, AI/Open Claw,
  Fortnox-ready) using the eight agent strategy documents in docs/composer-agents/.
  Use when implementing or extending the Roots web platform, design system, or integrations.
---

# Roots Website — Composer 2.0 Multi-Agent Workflow

## When to use this skill

- Implementing the marketing site, club dashboard, or sales portal for **Roots**
- Aligning UI with the Nordic "clean furniture brand" aesthetic (white + dark brown)
- Wiring **authentication (club vs sales)**, **API**, **AI/Open Claw**, or **Fortnox** preparation

## Source of truth

All strategic specifications live as plain text in:

`docs/composer-agents/`

| File | Agent focus |
|------|-------------|
| `INDEX.txt` | Overview and build order |
| `01_UX_IA_NAVIGATION.txt` | IA, navigation, CTAs, flows |
| `02_VISUAL_DESIGN_MOTION.txt` | Colors, typography, motion, Unsplash |
| `03_FRONTEND_STACK.txt` | Next.js, structure, performance |
| `04_BACKEND_API_DATA.txt` | API, entities, jobs |
| `05_AUTH_RBAC.txt` | Sessions, roles, route protection |
| `06_AI_OPENCLAW.txt` | AI BFF, RAG, Open Claw, MCP tools |
| `07_FORTNOX_COMMERCE.txt` | Fortnox abstraction, sync |
| `08_SECURITY_DEVOPS_SEO.txt` | Headers, CI/CD, SEO |
| `MASTER_BUILD_CHECKLIST.txt` | End-to-end checklist |

**Håranalys / leadmagnet (valfritt):** se `docs/composer-agents/hair-analysis/` och skill `roots-hair-analysis-composer`.

## Hard constraints (do not violate)

1. **Visual:** White background (`#FFFFFF`); signature dark brown scale starting at `#1C1410` — see Agent 02 for full tokens.
2. **Navigation:** Few top-level items; depth lives in dashboards after login.
3. **No emoji** in UI copy or decorative clutter; professional motion only (subtle pulse, slow floating shapes).
4. **AI keys:** Never expose Open Claw or LLM keys to the browser; always server-side BFF.
5. **Roles:** Club users and sales users are distinct; enforce RBAC in the **backend**, not only in UI.

## Suggested Composer workflow

1. Paste or reference the relevant `0X_*.txt` file when starting a task.
2. For full builds, follow `MASTER_BUILD_CHECKLIST.txt` phase order.
3. After each phase, run lint/tests and verify role isolation (club vs sales).

## Product context

- Three products: shampoo, conditioner, body wash (sold as a bundle for associations).
- Brand story: three founders over 1.95 m tall, different backgrounds, shared goal to strengthen Swedish **föreningsliv**.
- Integrations: **Open Claw** from day one (via backend); **Fortnox** prepared behind an abstraction layer.

## If documentation conflicts with code

Prefer updating code to match `docs/composer-agents/` unless the user explicitly changes strategy.
