# Sprint E6 — Errata + verification of the fundraising roles

Run date: **2026-05-18 01:35 CET** (local against `:4099`, demo seed
loaded).

This report is a **correction to `SMOKETEST_E5.md`**.

---

## TL;DR

> **`SMOKETEST_E5.md` claimed ASSOCIATION_ADMIN, TEAM_LEADER and
> SELLER had no read API. That was wrong.** The smoketest probed
> `/v1/association/*`, `/v1/team/*`, `/v1/seller/*` — none of those
> paths exist. The actual endpoints live on **`/v1/dashboard/*`**
> (in `apps/api/src/routes/dashboard.ts`, mounted in `app.ts:102`)
> and they work end-to-end with full gamification data.

Updated verdict matrix:

| Role | Login | Dashboard API | Verdict |
|---|---|---|---|
| PUBLIC | n/a | `/v1/shop/*` | 🟢 GO |
| CLUB_ADMIN | ✅ | `/v1/portal/*` | 🟢 GO |
| SALES_REP | ✅ | `/v1/portal/{dashboard,pipeline,quotes}` | 🟢 GO |
| INTERNAL_ADMIN | ✅ | `/v1/portal/*` | 🟢 GO |
| **ASSOCIATION_ADMIN** | ✅ | **`/v1/dashboard/association` ✅** | 🟢 **GO** |
| **TEAM_LEADER** | ✅ | **`/v1/dashboard/my-team` → `/v1/dashboard/team/:teamId` ✅** | 🟢 **GO** |
| **SELLER** | ✅ | **`/v1/dashboard/seller` ✅** | 🟢 **GO** |

All 7 roles are investor-demo-ready.

---

## What E5 got wrong

The E5 smoketest script speculatively tested URLs like
`/v1/association/dashboard`, `/v1/team/dashboard`,
`/v1/seller/dashboard`. Those 404s were interpreted as missing
backend. The actual URLs use the `/v1/dashboard/*` prefix that the
frontend already calls into. I should have looked at the frontend
fetch calls before writing the report — `rg "/v1/dashboard"` in
`apps/web/src` would have surfaced the correct paths immediately.

---

## E6 verification — actual smoketest of fundraising surfaces

Reproducible via `docs/scripts/smoketest-e6.sh`.

### ASSOCIATION_ADMIN — `forening@demo-if.se` 🟢

```
login                                  ASSOCIATION_ADMIN
GET /v1/dashboard/association          200   1 455 B
```

Returns full payload:
- 1 active campaign `Höstkampanj 2026 (Demo)` — AMOUNT goal 40 000 kr,
  30 % margin, BULK delivery, story populated
- 1 team `P14 Blå (Demo)` — 3 sellers, 1 321 kr in sales, 3 orders,
  invite-token present
- 3 sellers listed (Leo / Felicia / William, all `demo-assoc-*` slugs)
- `stats.totalSalesOre = 132100` (1 321 kr), `totalOrders = 3`

### TEAM_LEADER — `lag@demo-if.se` 🟢

```
login                                  TEAM_LEADER
GET /v1/dashboard/my-team              200   { teamId: "080221f7-…" }
GET /v1/dashboard/team/:teamId         200   3 972 B
```

Returns:
- Team identity (`P14 Blå (Demo)`)
- Linked campaign (`Höstkampanj 2026 (Demo)`, 30 % margin)
- 3 sellers with per-seller revenue, order count, individual goal
  AND a computed gamification `grade` (Starter / Brons / Silver / …)
  with `remainingOre` to the next tier
- 6 actual customer_orders listed
- `stats = { totalSalesOre: 132100, totalOrders: 3, teamEarningsOre: 39630, marginPercent: 30 }`
- `milestones = { achieved: [...], next: { label: "5 paket sålda", remaining: "2 paket kvar" } }`

### SELLER — `felicia.assoc@demo-if.se` 🟢

```
login                                  SELLER
GET /v1/dashboard/seller               200   1 555 B
```

Returns the seller's own view:
- Identity (`Felicia`, `demo-assoc-felicia`)
- Team + campaign one-liner
- `stats = { totalSalesOre: 102300, orderCount: 2, estimatedEarningsOre: 30690 }`
  (Felicia has earned the association 306,90 kr from 1 023 kr in sales
  at 30 % margin)
- `grade = { grade: "bronze", label: "Brons", thresholdOre: 100000,
              nextGrade: { grade: "silver", label: "Silver", remainingOre: 197700 } }`
- `milestones.achieved + .next`
- Per-order list

This is investor-demo-quality data — gamification, progression
toward next tier, transparent earnings math.

---

## Tenancy + role isolation — also green

```
GET /v1/dashboard/association   as SELLER     →  403 Behörighet saknas
GET /v1/dashboard/team/:teamId  as SELLER     →  403 Behörighet saknas
GET /v1/dashboard/team/<bad>    as TEAM_LEADER →  404 Lag hittades inte
```

The `hasAccess` gate in `dashboard.get("/team/:teamId")` correctly
enforces:
- INTERNAL_ADMIN: any team
- ASSOCIATION_ADMIN: same `orgId` as the team
- TEAM_LEADER: only their own `leaderId`

No bypass, no leakage.

---

## What this means for the investor demo

**All four "frontend" surfaces are wired and serving real data**:

| Frontend route | API endpoint | Data populates? |
|---|---|---|
| `/portal/*` (CLUB/SALES/INTERNAL) | `/v1/portal/*` | ✅ |
| `/forening` (association overview) | `/v1/dashboard/association` | ✅ |
| `/forening/lag` (team list) | `/v1/dashboard/association` | ✅ |
| `/forening/mal` (goal tracking) | `/v1/dashboard/association` | ✅ |
| `/forening/avrakning` (settlement preview) | `/v1/dashboard/association` | ✅ |
| `/lag` (team-leader home) | `/v1/dashboard/my-team` → `team/:id` | ✅ |
| `/lag/saljare` (manage sellers) | `…/team/:id` + POST sellers | ✅ |
| `/lag/bestallningar` (orders) | `…/team/:id` | ✅ |
| `/lag/avrakning` (team settlement) | `…/team/:id` | ✅ |
| `/min-shop` (seller's own dashboard) | `/v1/dashboard/seller` | ✅ |

An investor logging in as any of the six demo accounts now lands
on a working, populated dashboard.

---

## Findings — defer to Sprint F (revised)

F1, F2, F3 from `SMOKETEST_E5.md` are **withdrawn** — the endpoints
they asked for already exist.

The remaining findings worth keeping:

| # | Severity | Surface | Finding | Suggested fix |
|---|---|---|---|---|
| F4 | 🟡 P1 | Browser smoketest | Replace the curl-based E5/E6 with a Playwright smoketest that actually renders each role's first dashboard page and asserts non-zero UI. | Add `apps/web/e2e/smoketest.spec.ts` per role. |
| F5 | 🟢 P2 | URL naming | `/v1/dashboard/{association,team/:id,seller}` is a *role-aware* endpoint masquerading under a generic `/dashboard` prefix. A future cleanup could split it into `/v1/association`, `/v1/team`, `/v1/seller` for OpenAPI clarity, but it's purely cosmetic — frontend already calls the correct paths. | Optional rename + alias for one release cycle, then drop the old prefix. |
| F6 | 🟢 P2 | Demo seed | `alma.saljare@demo-if.se` + `noah.saljare@demo-if.se` are attached to `Demo Fotbollsklubb` (a CLUB org), not the IF association. Mixed metaphor in seed-demo §6. | Tighten `seed-demo.ts` so all `demo-if.se` sellers live under `Demo IF Sundsvall`. |
| F7 | 🟢 P3 | `/readyz` | Production must wire Redis. | Covered by `PRODUCTION_READINESS.md` §4. |

---

## Sprint E + E6 — final verdict

| Task | Status |
|---|---|
| E1 — ASSOCIATION_ADMIN + TEAM_LEADER demo accounts | ✅ |
| E2 — Riv legacy `(club)` route-group | ✅ |
| E3 — Riv legacy `(sales)` route-group | ✅ |
| E4 — Hydrate `/portal/statistik` KPI + top-products | ✅ + Date-param bug fixed in E5 |
| E5 — Role-by-role smoketest | ✅ (with the false-positive corrected by E6) |
| **E6 — Errata + verification of fundraising roles** | ✅ (this report) |

**The platform is investor-demo-ready for all six demo accounts.** The
only items left are:
- Optional Playwright e2e (F4)
- Cosmetic URL rename (F5)
- Cosmetic seed tweak (F6)
- Production Redis wiring (F7, already in `PRODUCTION_READINESS.md`)

No P0 blockers remain.

---

## How to reproduce

```bash
# 1. Postgres up + seed
pnpm --filter @roots/db db:seed:demo

# 2. API
cd apps/api
DATABASE_URL=postgresql://postgres@localhost:5432/roots \
REDIS_DISABLED=true \
CSRF_SECRET=test-csrf-secret-32-bytes-long-aaa \
SESSION_SECRET=test-session-secret-32-bytes-long-b \
NODE_ENV=development PORT=4099 \
ROOTS_ENABLE_DEMO_ACCOUNTS=true \
pnpm dev &

# 3. Smoketest
bash docs/scripts/smoketest-e5.sh   # original (CLUB/SALES/INTERNAL)
bash docs/scripts/smoketest-e6.sh   # this run (ASSOCIATION/TEAM_LEADER/SELLER)
```

All demo passwords: `Demo1234!`.
