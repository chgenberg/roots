# Roots -- Foreningsnara hudvard

A B2B2C platform for natural skincare products (shampoo, conditioner, body wash) targeting Swedish associations (`foreningsliv`).

## Architecture

Turborepo monorepo with two apps and four shared packages:

```
roots/
  apps/
    web/          Next.js 15 App Router (frontend)
    api/          Hono + tRPC (backend)
  packages/
    ui/           Shared React components (Container, Section, Card, Button, Input, FloatingShape)
    db/           Drizzle ORM schemas + PostgreSQL client
    contracts/    Shared Zod schemas + TypeScript types (roles, products, orders, auth, invoicing)
    config/       Shared ESLint, Tailwind, TypeScript configs
```

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Backend:** Hono, tRPC v11, Zod
- **Database:** PostgreSQL (Drizzle ORM), Redis (sessions + rate limiting)
- **Auth:** Argon2id passwords, Redis-backed sessions, TOTP MFA, RBAC
- **AI:** Open Claw via BFF (server-side only), SSE streaming, MCP tools
- **Invoicing:** Fortnox abstraction layer (feature-flagged)
- **Deploy:** Railway (web + api services, Postgres + Redis addons)

## Getting Started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Web runs on `http://localhost:3000`, API on `http://localhost:4000`.

## Route Structure

| Group | Routes | Access |
|-------|--------|--------|
| Marketing | `/`, `/produkter`, `/produkter/[slug]`, `/foreningsliv`, `/om-oss` | Public |
| Auth | `/login`, `/registrera` | Public |
| Club | `/club/dashboard`, `/club/bestall`, `/club/historik`, `/club/konto` | CLUB_ADMIN, CLUB_MEMBER |
| Sales | `/sales/dashboard`, `/sales/offerter`, `/sales/ordrar`, `/sales/kunder`, `/sales/admin` | SALES_REP, SALES_ADMIN |

## Strategy Documents

All design and architecture specifications live in `docs/composer-agents/`. See `docs/composer-agents/INDEX.txt` for the full index and `MASTER_BUILD_CHECKLIST.txt` for the phase-by-phase build plan.

## Formulations

Product formulation specs (for the chemist) are in `FORMULATIONS.md` and the corresponding Word documents.
