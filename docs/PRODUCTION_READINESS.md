# Production Readiness Checklist

Last updated as part of **Sprint D — Prod-konfig** (investor-demo readiness).

This checklist is the GO/NO-GO gate before pointing a customer (or an
investor) at a production URL. Every item that isn't checked is either a
known degradation or a risk we've accepted in writing.

---

## 1. Environment variables

The API process runs `validateEnvOrExit()` at boot (see
`apps/api/src/lib/validate-env.ts`). In `NODE_ENV=production` it will
**refuse to start** if anything in REQUIRED is missing or still holds
the `.env.example` placeholder.

### REQUIRED (boot fails if missing/placeholder)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis (sessions, rate-limit) |
| `CSRF_SECRET` | HMAC secret for CSRF tokens |
| `SESSION_SECRET` | HMAC secret for session cookies |
| `CORS_ORIGIN` | Allowed browser origin for `/v1/*` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (Klarna redirects, emails) |
| `NODE_ENV=production` | Enables prod-only middleware |

### RECOMMENDED (feature degrades cleanly if missing)

| Var | Without it… |
|---|---|
| `OPENAI_API_KEY` | Open Claw assistant + hair analysis disabled |
| `RESEND_API_KEY` | Contact-form + invite emails are no-ops |
| `KLARNA_WEBHOOK_SECRET` *(or `KLARNA_WEBHOOK_IPS`)* | Klarna webhook fails closed — checkout will not finalise |
| `FORTNOX_WEBHOOK_SECRET` | Fortnox webhook signature verification disabled — integration off |
| `SENTRY_DSN` | Uncaught errors only land in stdout (no alerting) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | No frontend analytics |

### Investor-demo extras

| Var | Why |
|---|---|
| `ROOTS_ENABLE_DEMO_ACCOUNTS=true` | Keeps the seeded `admin@roots.se` / `klubb@demo-if.se` / `salj@roots.se` accounts loginable in production |
| `ROOTS_ALLOW_PROD_SEED=true` | Only if you deliberately want `db:seed` to reset the demo passwords in this environment |

### Cross-checks (boot fails on conflict)

Each variable can be present and the deployment still broken, because what
makes them correct is how they relate to each other. The validator therefore
also rejects:

| Conflict | Why it fails the boot |
|---|---|
| `CORS_ORIGIN` does not contain `NEXT_PUBLIC_SITE_URL`'s origin | Every `/v1` call from the browser fails preflight. Everything looks configured; nothing works |
| `NEXT_PUBLIC_SITE_URL` is not `https` | Klarna redirects and email links break |
| Any signing secret shorter than 32 chars | Forgeable signatures |
| Two signing secrets sharing a value | One leak becomes two |
| `REDIS_DISABLED`, `ROOTS_KLARNA_STUB`, `ROOTS_ALLOW_UNSIGNED_KLARNA_WEBHOOK`, `ROOTS_ALLOW_DEMO_WRITES`, `SCHEDULER_DISABLED` = `true` | Dev shortcuts that mark orders paid without money moving, or turn off cron and Redis |
| `ROOTS_ENABLE_DEMO_ACCOUNTS=true` without a 12+ char `ROOTS_DEMO_PASSWORD` | A demo account with a known password is an open door |

Reference: `.env.example` is the authoritative list; the validator
keeps it honest.

---

## 2. Health / readiness probes

| Endpoint | Type | Purpose | Touches DB/Redis? |
|---|---|---|---|
| `GET /healthz` | Liveness | Process responds | No |
| `GET /readyz` | Readiness | DB + Redis ping (1.5s timeout each) | Yes |
| `GET /health` | Legacy | Same as `/healthz` (kept for back-compat) | No |

On Railway, set the health-check path to **`/readyz`**. A `503` from
this endpoint means traffic should be drained.

`healthcheckTimeout` is **300s**, not the 30s it used to be. The API runs
migrations *before* `serve()` starts listening, and a replica that loses
the advisory-lock race waits up to `MIGRATE_LOCK_TIMEOUT_MS` (60s
default). During that window there is no listener at all, so the probe
gets `ECONNREFUSED` — a 30s budget could fail a deploy whose migrations
were working correctly.

Note also that the API connects to Redis before it starts listening. With
`lazyConnect` + `enableOfflineQueue: false`, the *first* Redis command
after boot is rejected while the socket is still handshaking, which made
`/readyz` answer `503` on the first probe and `ok` on the second. See
`connectRedis()` in `apps/api/src/lib/redis.ts`.

---

## 3. Database

- [ ] `DATABASE_URL` points to a **production** Postgres, not the dev
      mirror.
- [ ] At least one nightly backup snapshot has been verified by
      attempting a restore into a scratch database. The procedure, the
      verification queries and the quarterly drill live in
      `docs/runbooks/backup-restore.md`; `scripts/db-backup.sh` takes an
      off-site dump. **A backup that has never been restored is not a
      backup** — this box stays unchecked until someone has run the drill.
- [ ] Migrations: the API runs pending migrations at boot by default
      (advisory-locked, so replicas are safe). Only set
      `RUN_MIGRATIONS_ON_BOOT=false` if the pipeline runs
      `pnpm db:migrate` as its own release step.
- [ ] Connection limit on the DB allows for the API replica count plus
      the worker process plus 2 for migrations.
- [ ] Demo seed has been run with `pnpm db:seed:demo` if this is the
      investor-demo environment.

---

## 4. Sessions, CSRF, CORS

- [ ] `SESSION_SECRET` and `CSRF_SECRET` are 32+ bytes from
      `openssl rand -hex 32`, **not** rotated copies of each other.
- [ ] `CORS_ORIGIN` exactly matches `NEXT_PUBLIC_SITE_URL`. Mismatch =
      every POST silently fails the CSRF check on the browser side.
- [ ] Redis is reachable from the API container. `/readyz` confirms.

---

## 4b. Scheduled jobs

The API process runs its own periodic jobs — no external cron needed.
Each job claims a Redis key with a TTL equal to its interval, so it runs
**at most once per interval across the whole fleet** regardless of replica
count, and the schedule survives restarts.

| Job | Interval | What it does |
|---|---|---|
| `deletion-purge` | 6h | GDPR art. 17 — anonymises users whose cooldown has expired |
| `lead-retention` | 24h | Deletes hair-analysis leads past their retention window |
| `monitoring-check` | 5min | Alerts on a downed DB/Redis or a job that has gone silent |

- [ ] Redis is reachable. Without it the scheduler skips every run
      (deliberately: better a missed run than two concurrent ones).
- [ ] `audit_logs` contains a recent `cron.deletion_purge` row. That's
      the answer to "when did the purge last run?".
- [ ] `SCHEDULER_DISABLED` is unset, **unless** an external cron is
      calling the `/v1/internal/cron/*` endpoints instead.
- [ ] `GET /v1/internal/cron/status` (bearer token) returns `ok: true`.
      A job that has never reported counts as silent, which is usually a
      cron that was never wired up after an environment move.

Registered in `apps/api/src/lib/scheduled-tasks.ts`. The
`/v1/internal/cron/*` endpoints remain available for manual or external
triggering; both paths write the same audit row and the same heartbeat.

Every new cron endpoint must also be added to `CSRF_EXEMPT_PATHS` in
`app.ts` — the list is exact, not prefix-based, so a missing entry means the
job returns 403 and silently never runs.

Alerting is covered in section 6 and [monitoring.md](./runbooks/monitoring.md).

### Background jobs (pg-boss) — before enabling

`WORKERS_ENABLED` is **unset in production**, so the pg-boss queue is a
no-op there today and `enqueueJob` throws (`DisabledQueue`). The only
caller, `scheduleOrgNormalize`, early-returns on that flag, so nothing
breaks. Before flipping it on:

- [ ] Deploy a separate worker service running `node dist/workers/index.js`.
      The API process starts pg-boss in producer mode only — it registers
      no handlers and never claims jobs.
- [ ] Decide what watches `system.dead-letter`. Jobs that exhaust their
      three retries land there, and **nothing consumes or alerts on it**
      today — they sit until `keep_until` expires. Dead-lettering beats
      dropping, but it is not monitoring.
- [ ] Note that most handlers in `apps/api/src/workers/index.ts` are
      still no-op placeholders that only log their payload.

---

## 5. External integrations

| Integration | Required for prod-demo? | Current status |
|---|---|---|
| Klarna checkout | ❌ optional | Webhook signature OR IP allowlist required; route fails closed in prod if neither is set |
| Fortnox invoicing | ❌ optional | Off by default (`FORTNOX_ENABLED=false`) |
| BankID | ❌ optional | Stub adapter active until `BANKID_PFX_PATH` is set |
| Resend (email) | ⚠ recommended | Contact form returns 502 if Resend rejects, but no crash |
| OpenAI | ⚠ recommended | AI surfaces show empty-state UX if missing |

---

## 6. Observability

**API-side Sentry is wired** (Sprint D+1). Sets `SENTRY_DSN` and
relevant tracking is automatic — every uncaught route error,
`unhandledRejection`, `uncaughtException`, and boot failure is
captured. See `apps/api/src/lib/sentry.ts`.

- [x] `@sentry/node` initialised when `SENTRY_DSN` is set
- [x] Hono `onError` handler forwards 5xx to Sentry with route + method tags
- [x] `unhandledRejection` + `uncaughtException` reported with `type` tag
- [x] Boot failures captured before exit(1) with `phase=boot` tag
- [x] `flushSentry()` called from SIGTERM/SIGINT so no events lost on redeploy

Operational checks regardless of Sentry:
- [ ] Railway / hosting provider logs are tailed during the demo.
- [ ] Slack / email alert is set on Railway "deploy crashed" events.
- [ ] `/readyz` is hit from an uptime monitor (e.g. UptimeRobot,
      Better Uptime) every 60s. **This is the only thing that catches "the
      API is down"** — a process cannot alert about itself not running.

### 6b. Alerting

Sentry catches errors. What it cannot catch is *silence*: a cron job that
stops being triggered raises no error, because no code runs. Alerting for
that is now in place — `apps/api/src/lib/monitoring/`, documented in
[monitoring.md](./runbooks/monitoring.md).

- [x] Each scheduled job records a heartbeat after a **successful** run;
      going quiet past its interval plus grace raises an alert
- [x] DB and Redis outages raise an alert
- [x] Alerts go to both email and Sentry, so an outage shows up in the same
      timeline as the errors it caused
- [x] The same alert is not repeated within four hours; the cooldown clears
      on recovery, so a returning outage alerts immediately
- [x] The check runs in-process every 5 min, so it works without any ops
      setup, and is also exposed as `POST /v1/internal/cron/monitoring-check`
- [ ] `ALERT_EMAIL` is set. Without it alerts are logged and sent to Sentry,
      but nobody gets woken up.
- [ ] External uptime watch on `/readyz` (see above). Two gaps depend on it:
      the API process being dead, and Redis being down — the in-process
      scheduler claims its slot via Redis, so without Redis the check itself
      does not run.

Not yet monitored, stated plainly so nobody assumes wider coverage: orders
stuck in `PENDING`, jobs that run but fail every time, response-time and
error-rate thresholds, and certificate expiry.

**Frontend errors are now captured too** — but not via `@sentry/nextjs`.
The web app posts to `POST /v1/telemetry/client-errors`, which forwards to
the same Sentry project with `source=web`. That keeps the DSN server-side
and out of the client bundle, and avoids the Next.js webpack plugin.

- [x] Render errors from `app/error.tsx` + `app/global-error.tsx`
- [x] `window.onerror` + `unhandledrejection` via `Providers`
- [x] Per-IP rate limit + noise filter (extensions, `ResizeObserver`, …)

Remaining, and worth being explicit about: the client stack traces are
minified. Grouping works on message + URL + kind, which is usually enough
to find the spot, but a source-map upload would make them readable.

- [ ] Source-map upload for readable frontend stack traces.
- [ ] Sentry release-tagging tied to the CI build SHA.
- [ ] Performance / tracing dashboard tuning once we have a baseline.

---

## 7. Smoke test before flipping DNS

Run against the production URL, signed in as the investor-demo
`admin@roots.se`:

1. `GET /healthz` → 200
2. `GET /readyz` → 200 with `db.ok=true` and `redis.ok=true`
3. Sign in → portal dashboard loads with non-zero data (Sprint B seed
   should have populated 5 orders + 4 quotes + 12 members)
4. `/portal/offerter` → "Ny offert" dialog → save DRAFT → quote appears
   in the list
5. `/portal/medlemmar` → "Bjud in medlem" → new row appears
6. `/portal/installningar` → change password → log out → log back in
   with the new password (then rotate back so the demo account stays
   on `roots-demo-2025`)
7. Public site → product page → add to cart → reach Klarna iframe
   (don't complete payment unless using playground creds)

All seven must pass before sharing the URL.

---

## 7b. Automated test of the money path

Most of the suite mocks `@roots/db` and checks one route at a time. That
catches shape errors but not the thing that costs real money: whether the
chain shop → checkout → payment → verification → settlement holds
together. Every step can be individually correct and the payout still
wrong, because those bugs live in the seams.

`apps/api/src/routes/money-path.integration.test.ts` therefore runs
against a real Postgres and asserts the outcome in kronor. It covers:

- The shop only offers products curated into the campaign, at the
  campaign price — a product that is active but not in the campaign is
  rejected by checkout.
- Checkout refuses an order without accepted terms, and stores
  `termsAcceptedAt` + `termsVersion` when they are accepted.
- The margin is frozen on the order, so changing the campaign margin
  later cannot move money on sales already made.
- A double-click returns the same order instead of creating two.
- Settlement counts only paid orders — an abandoned checkout never
  becomes a payout.
- A manual order stays out of the payout until a team leader verifies it,
  the seller cannot verify their own, and it is reported as pending
  rather than silently dropped.
- Team share + Roots share always sum exactly to total sales, so no öre
  disappears in rounding.
- An order that has been cancelled or refunded leaves the payout, and
  cannot be brought back to life by undoing the delivery flag.
- Cancelling requires a reason, and is blocked with a 409 when the team's
  payout is already invoiced or paid, so the basis and the transferred
  amount cannot drift apart unnoticed.

Without `DATABASE_URL` the file skips instead of failing, so `pnpm test`
still works on a laptop with no database. CI has Postgres and Redis as
service containers and runs `pnpm db:migrate` before `pnpm test`, so
there it runs for real. To run it locally:

```bash
createdb roots_e2e_test
export DATABASE_URL=postgresql://localhost:5432/roots_e2e_test
export REDIS_URL=redis://localhost:6379
pnpm db:migrate
pnpm --filter @roots/api test
```

The test creates its own organization, campaign, team, seller and
products under a per-run unique suffix and deletes them again in
`afterAll`, so it is repeatable and leaves nothing behind. Point it at a
throwaway database anyway.

It reaches `PAID` through the Klarna stub (`ROOTS_KLARNA_STUB`), which
the payment code refuses to honour when `NODE_ENV=production`. Once
Klarna is signed, the payment leg should also be exercised against their
playground — see section 8.

---

## 7c. Theme and contrast check

Dark mode used to be applied only by the toggle in the marketing header,
which lives on no logged-in page. The class therefore survived a
client-side navigation into the portal but was absent on a hard load —
the same page had two appearances depending on how you reached it. The
theme is now applied by a blocking script in `apps/web/src/app/layout.tsx`
before first paint, and the toggle sits in both the portal and the
fundraising sidebar.

`scripts/check-dark-mode.mjs` walks 23 public and logged-in views with
`roots-theme=dark`, measures every text node against its own painted
background and fails on anything below WCAG AA (4.5:1 for body text,
3:1 for large text). It also flags a page where the theme class never
landed or the toggle is missing. Screenshots go to `/tmp/roots-dark`.

```bash
# web on 3004, API on 3011, demo-seeded database
node scripts/check-dark-mode.mjs
```

Two things to know when it fails on login rather than contrast: the
login limiter allows 5 attempts per 15 minutes per email, so repeated
runs get 429s — clear them with
`redis-cli --scan --pattern 'rl:login:*' | xargs redis-cli del`. And in
dev, Next compiles each route on first visit, which is why the script
waits for the URL to commit rather than for the load event.

Purely decorative watermark numerals are excluded: they sit at 1.35:1 in
light mode too, so they are a design choice rather than a dark-mode
regression.

---

## 7d. Order lifecycle

`customer_order_status` has carried `CANCELLED` and `REFUNDED` since the
first migration, but no code path ever set them. A mis-registered manual
order could only be corrected directly in the database, and an order the
customer had been refunded stayed in the team's earnings because the
status never changed. The delivery endpoint had the opposite problem: it
existed and worked, but nothing in the UI called it, so an order could
become paid and then never move again.

An order now runs `PENDING → PAID → SHIPPED → DELIVERED`, with
`CANCELLED` / `REFUNDED` as exits from any of the paid states. All of
this happens in the order dialog, which is shared by seller, team leader,
association admin and internal admin — the server computes
`canManageFulfillment` and `canCancel` per role so the buttons cannot
appear in front of someone who may not press them.

Three rules are worth knowing, because they exist to protect money
rather than to be tidy:

- A Klarna-paid order cannot be *cancelled*, only *refunded*. Cancelling
  it here would leave the customer's money with Klarna and nothing would
  flag it. The response also says outright that the refund still has to
  be performed in Klarna's portal, since we cannot execute it ourselves
  until the contract is signed.
- A closed order cannot be reopened through the delivery endpoint. "Undo
  delivery" sets the status back to `PAID`, and without the guard that
  path would resurrect money that has already left.
- Cancelling an order whose team payout is already `INVOICED` or `PAID`
  returns 409 with `requiresForce`. The settlement deliberately refuses
  to recalculate locked payouts, so the cancellation has to be a
  conscious decision that is also handled in the bookkeeping.

A seller may cancel their own manual order until a leader has verified
it — that is a correction, not a money movement. After verification it
takes a leader or above.

`scripts/check-order-lifecycle-ui.mjs` walks the flow in a browser:
delivery steps, the undo path, the reason requirement and the wording
about what happens to the money. It restores the demo order afterwards.

```bash
# web on 3004, API on 3011, demo-seeded database
node scripts/check-order-lifecycle-ui.mjs
```

---

## 8. What's intentionally *not* in scope yet

- Auto-scaling / multi-instance API. Single Railway instance is fine
  for the investor demo.
- Database read replicas.
- Image CDN / signed media URLs.
- GDPR data-export endpoint (manual export is the documented fallback).
- Payment leg tested against Klarna's playground rather than our stub.
  Blocked on the Klarna contract; the rest of the money path is covered
  by the integration test in section 7b.
- Browser-level E2E (Playwright is a dev dependency, but there is no test
  runner wired up). The money path is covered at the API level instead.
