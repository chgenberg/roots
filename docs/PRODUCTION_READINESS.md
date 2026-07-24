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
      attempting a restore into a scratch database.
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

- [ ] Redis is reachable. Without it the scheduler skips every run
      (deliberately: better a missed run than two concurrent ones).
- [ ] `audit_logs` contains a recent `cron.deletion_purge` row. That's
      the answer to "when did the purge last run?".
- [ ] `SCHEDULER_DISABLED` is unset, **unless** an external cron is
      calling `POST /v1/internal/cron/deletion-purge` instead.

Registered in `apps/api/src/lib/scheduled-tasks.ts`. The
`/v1/internal/cron/*` endpoints remain available for manual or external
triggering; both paths write the same audit row.

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
      Better Uptime) every 60s.

Pending for a follow-up commit (out of scope for Sprint D+1):
- [ ] Frontend `@sentry/nextjs` mirror via `NEXT_PUBLIC_SENTRY_DSN`
      (requires the Next.js webpack-plugin + source-maps upload — needs
      `SENTRY_AUTH_TOKEN` + dedicated test in staging).
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

## 8. What's intentionally *not* in scope yet

- Auto-scaling / multi-instance API. Single Railway instance is fine
  for the investor demo.
- Database read replicas.
- Image CDN / signed media URLs.
- GDPR data-export endpoint (manual export is the documented fallback).
