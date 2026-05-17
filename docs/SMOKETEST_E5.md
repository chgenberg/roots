# Sprint E5 — Role-by-role API smoketest

Run date: **2026-05-17 23:25 CET** (local against `:4099` with
`REDIS_DISABLED=true`, `NODE_ENV=development`, demo-seed loaded from
`pnpm db:seed:demo`).

This is the production-readiness smoketest from
[`PRODUCTION_READINESS.md` §7](./PRODUCTION_READINESS.md) expanded to
**all six demo roles** plus the public visitor surface. It is the
GO/NO-GO gate for the investor demo.

> **Method**: HTTP curl against the live API, real session cookies
> obtained via `POST /v1/auth/login` per role. Bodies inspected and
> shape-checked. No browser — frontend rendering is verified by the
> Vitest snapshot suite (102 tests green, locked to the same wire
> format the UI calls into).

---

## 0. Top-line verdict

| Role | Login | Dashboard data | Verdict |
|---|---|---|---|
| **PUBLIC** (no auth) | n/a | `/v1/shop/products` + `/v1/shop/by-slug/<seller>` | 🟢 GO |
| **CLUB_ADMIN** | ✅ | dashboard, statistics, income, orders, members, quotes all 200 | 🟢 GO |
| **SALES_REP** | ✅ | dashboard, pipeline, quotes all 200; statistics 403 (by design) | 🟢 GO |
| **INTERNAL_ADMIN** | ✅ | dashboard, statistics, pipeline all 200 | 🟢 GO |
| **ASSOCIATION_ADMIN** | ✅ | **no `/v1/association/*` endpoints exist** | 🔴 NO-GO |
| **TEAM_LEADER** | ✅ | **no `/v1/team/*` endpoints exist** | 🔴 NO-GO |
| **SELLER** | ✅ | **no `/v1/seller/*` endpoints exist** | 🔴 NO-GO |

**Investor-demo recommendation:** demo the **CLUB / SALES / INTERNAL**
flows and the **public seller shop** (`/shop/demo-alma` shows campaign
+ team + products with real seeded data). Skip the
fundraising-portal-internal dashboards until F1 ships the missing
endpoints.

---

## 1. Health probes (§7 step 1–2)

```
GET /healthz                  200   { status: ok }
GET /readyz                   503   degraded — db.ok=true, redis.ok=false
GET /v1/csrf-token            200   { token: "..." }
```

`/readyz` is **503 by design** in this run because `REDIS_DISABLED=true`
locally. In production Redis must be reachable; the gate at `§7` step 2
is `db.ok=true` AND `redis.ok=true`.

---

## 2. PUBLIC visitor

```
GET /v1/shop/products                  200   1 285 B
GET /v1/shop/by-slug/demo-alma         200   2 188 B   ← seeded seller, full payload
GET /trpc/auth.me  (no cookie)         401   UNAUTHORIZED  ← correct
```

Payload `demo-alma` includes seller, team (`"Herr A-lag (Demo)"`),
campaign (`"Vårkampanj 2026 (Demo)"`) and products. Public discovery
flow is investor-ready.

> **Schema note**: seller `shop_slug` columns are prefixed with `demo-`
> (e.g. `demo-alma`, `demo-noah`, `demo-assoc-felicia`). Marketing
> copy that links to `/shop/<firstname>` would 404; always derive the
> URL from `seller.shopSlug` returned by the API.

---

## 3. CLUB_ADMIN — `klubb@demo.se` 🟢

```
login                                  CLUB_ADMIN
GET /v1/portal/dashboard               200   132 B   { role, isDemo:false, stats:{members, orders, revenue, ...} }
GET /v1/portal/statistics              200   1 262 B { monthlyData, totals, kpis, topProducts }
GET /v1/portal/income                  200   256 B   { months:[…], totalEarnedOre }
GET /v1/portal/orders                  200   1 717 B order list
GET /v1/portal/members                 200   2 434 B member roster
GET /v1/portal/quotes                  200   13 B    empty array (no quotes seeded)
GET /trpc/auth.me                      200   { role: "CLUB_ADMIN", orgId, … }
```

All 6 portal surfaces respond with real org-scoped data. The KPI
block + topProducts on `/statistics` (Sprint E4) is hydrated:

```jsonc
"kpis": {
  "totalRevenue": "2 006 kr",
  "avgOrderValue": "1 003 kr",
  "newMembersThisPeriod": 23,
  "activeMembersThisPeriod": 1,
  "prevPeriodRevenuePercent": -45.4,
  "prevPeriodOrdersPercent": 0,
  "prevPeriodMembersPercent": null
},
"topProducts": [
  { "name": "Roots Shampoo", "soldUnits": 20, "revenue": "2 980 kr", "sharePercent": 38.8 },
  ...
]
```

---

## 4. SALES_REP — `salj@roots.se` 🟢

```
login                                  SALES_REP
GET /v1/portal/dashboard               200   174 B   { stats: {openQuotes, clubs, pipelineValue, …} }
GET /v1/portal/pipeline                200   999 B   { stages:[…], deals:[…] }
GET /v1/portal/quotes                  200   1 151 B quote list
GET /v1/portal/statistics              403   Behörighet saknas  ← correct (orders not seller-owned)
GET /trpc/auth.me                      200
```

Pipeline + quotes flow works end-to-end. The `403` on `/statistics` is
the Connection-Audit P0 fix from earlier — sales reps don't own orders
so their dashboard lives on `/pipeline`.

---

## 5. INTERNAL_ADMIN — `admin@roots.se` 🟢

```
login                                  INTERNAL_ADMIN
GET /v1/portal/dashboard               200   153 B   { stats: {activeClubs, mrr, totalOrders, …} }
GET /v1/portal/statistics              200   1 262 B platform-wide aggregate
GET /v1/portal/pipeline                200   999 B
GET /trpc/auth.me                      200
```

Platform-wide aggregates honoured (`isPlatformAdmin` branch in
`portal.ts` keeps `orgId` null safely without leaking to club roles).

---

## 6. ASSOCIATION_ADMIN — `forening@demo-if.se` 🔴

```
login                                  ASSOCIATION_ADMIN
GET /trpc/auth.me                      200   role:"ASSOCIATION_ADMIN", orgId set
GET /v1/portal/dashboard               403   Behörighet saknas    ← correct, isolation OK
GET /v1/association/dashboard          404   Not Found            ← endpoint missing
GET /v1/association/teams              404   Not Found            ← endpoint missing
GET /v1/association/campaigns          404   Not Found            ← endpoint missing
```

**Root cause**: `apps/api/src/app.ts` mounts `auth`, `shop`, `checkout`,
`dashboard`, `settlement`, `sharing`, `bankid`, `contact`, `portal`,
`fortnox-webhook`, `ai`. **No `/v1/association/*` router exists**.

What does exist:
- `tRPC` `campaignsRouter.create/update/activate` (`associationProcedure` middleware) — write paths only, no list/get.
- `tRPC` `teamsRouter.create/setGoal/regenerateInviteToken` (`teamLeaderProcedure`) — write paths only.

The fundraising-portal frontend (`/forening/*`) therefore has no read
API to drive its dashboard, team list, campaign list, or seller list.

**Verified isolation**: the 403 on `/v1/portal/dashboard` for this role
confirms the Connection-Audit P0 fix from an earlier sprint still
holds — fundraising sessions cannot leak into platform aggregates.

---

## 7. TEAM_LEADER — `lag@demo-if.se` 🔴

```
login                                  TEAM_LEADER
GET /trpc/auth.me                      200   role:"TEAM_LEADER", orgId set
GET /v1/team/dashboard                 404   Not Found
GET /v1/team/sellers                   404   Not Found
GET /v1/team/orders                    404   Not Found
```

Same root cause as §6 — no `/v1/team/*` router. tRPC has team-create /
setGoal mutations only.

The seed (`pnpm db:seed:demo` §8) created:
- 1 team owned by `lag@demo-if.se` → `Herr A-lag (Demo)`
- 3 sellers attached to that team (`demo-assoc-leo`, `-felicia`, `-william`)
- 6 customer_orders against those sellers (status PAID/SHIPPED/DELIVERED)

…all of which is invisible to the TEAM_LEADER until a list/get API is built.

---

## 8. SELLER — `felicia.assoc@demo-if.se` 🔴

```
login                                  SELLER
GET /trpc/auth.me                      200   role:"SELLER"
GET /v1/seller/me                      404   Not Found
GET /v1/seller/orders                  404   Not Found
GET /v1/seller/dashboard               404   Not Found
```

Same root cause. Public `/shop/demo-assoc-felicia` works (that route
goes through `/v1/shop/by-slug/...`, which is public). The seller's
**own** dashboard view does not.

---

## 9. Regression caught + fixed during this run

While smoke-testing CLUB_ADMIN + INTERNAL_ADMIN, `/v1/portal/statistics`
returned **500** with:

```
TypeError [ERR_INVALID_ARG_TYPE]: The "string" argument must be of
type string or an instance of Buffer or ArrayBuffer. Received an
instance of Date
  at Function.byteLength (node:buffer:776:11)
  at Function.str (postgres@3.4.8/.../bytes.js:22:27)
```

Source: in Sprint E4 I had written
```ts
sql`${orders.createdAt} < ${until}`
```
where `until` is a `Date`. The `postgres` driver expects a string
parameter — drizzle's `sql` template doesn't auto-stringify Date
operands the way the helper functions do.

**Fix shipped in this commit**:
```ts
import { ..., lt } from "drizzle-orm";
...
lt(orders.createdAt, until)
```

Re-ran the suite: 102 tests green, `/v1/portal/statistics` 200 with
the full payload (kpis + topProducts populated for both CLUB_ADMIN
and INTERNAL_ADMIN). Without this fix the four KPI cards from E4
would have been silently 500 in production.

---

## 10. Findings — defer to Sprint F

These are NOT blockers for an investor demo of the CLUB / SALES /
INTERNAL flow, but they must be closed before the fundraising-portal
roles are part of a customer-facing pitch.

| # | Severity | Surface | Finding | Suggested fix |
|---|---|---|---|---|
| F1 | 🔴 P0 | `/v1/association/*` | Router does not exist. ASSOCIATION_ADMIN has no read API. | Add `apps/api/src/routes/association.ts` with `dashboard`, `teams`, `campaigns`, `sellers`, `orders`. Mount in `app.ts`. |
| F2 | 🔴 P0 | `/v1/team/*` | Router does not exist. TEAM_LEADER has no read API. | Add `apps/api/src/routes/team.ts` with `dashboard`, `sellers`, `orders`, scoped via the leader's `team_id`. |
| F3 | 🔴 P0 | `/v1/seller/*` | Router does not exist. SELLER has no read API for own dashboard. | Add `apps/api/src/routes/seller.ts` with `me`, `orders`, `dashboard`, scoped via `seller.user_id`. |
| F4 | 🟡 P1 | Frontend | `/forening`, `/lag`, `/min-shop` page wiring needs verification once F1–F3 land. | Browser smoketest once read APIs exist. |
| F5 | 🟢 P2 | `/v1/shop/by-slug/<slug>` | Slugs are prefixed `demo-` in seeded data. | Documentation + marketing copy must read the slug back from the API rather than guessing `/shop/<firstname>`. |
| F6 | 🟢 P2 | Demo seed | The non-IF sellers `alma.saljare@demo-if.se` + `noah.saljare@demo-if.se` are attached to `Demo Fotbollsklubb` (a club org), not the association. Mixed metaphor. | Tighten seed-demo §8 to attach all `demo-if.se` sellers to `Demo IF Sundsvall`. |
| F7 | 🟢 P3 | `/readyz` | 503 in this run because `REDIS_DISABLED=true`. Production must wire Redis. | `PRODUCTION_READINESS.md` §4 covers this; tracked there. |

---

## 11. Sprint E close-out

| Task | Status |
|---|---|
| E1 — ASSOCIATION_ADMIN + TEAM_LEADER demo accounts + seed | ✅ |
| E2 — Riv legacy `(club)` route-group | ✅ |
| E3 — Riv legacy `(sales)` route-group | ✅ |
| E4 — Hydrate `/portal/statistik` KPI + top-products | ✅ + fix shipped this commit |
| E5 — Role-by-role smoketest | ✅ (this report) |

Sprint E **achieves its scope for an investor demo of the CLUB /
SALES / INTERNAL surface**. Fundraising-portal completeness moves to
Sprint F (`F1`–`F4` above).

---

## 12. How to reproduce this smoketest

```bash
# 1. Ensure Postgres has demo data
pnpm --filter @roots/db db:seed:demo

# 2. Start the API
cd apps/api
DATABASE_URL=postgresql://postgres@localhost:5432/roots \
REDIS_DISABLED=true \
CSRF_SECRET=test-csrf-secret-32-bytes-long-aaa \
SESSION_SECRET=test-session-secret-32-bytes-long-b \
NODE_ENV=development \
PORT=4099 \
ROOTS_ENABLE_DEMO_ACCOUNTS=true \
pnpm dev &

# 3. Wait ~8s for boot, then run
bash /tmp/roots-smoketest/run.sh   # script is checked in as
                                   # docs/scripts/smoketest-e5.sh
```

All demo passwords are `Demo1234!` (per `auth.ts` `DEMO_ACCOUNTS`).
