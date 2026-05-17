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
| `RUN_MIGRATIONS_ON_BOOT=true` | Recommended on Railway (single-instance) so the schema is always current |

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

---

## 3. Database

- [ ] `DATABASE_URL` points to a **production** Postgres, not the dev
      mirror.
- [ ] At least one nightly backup snapshot has been verified by
      attempting a restore into a scratch database.
- [ ] `RUN_MIGRATIONS_ON_BOOT=true` is set, **OR** the deployment
      pipeline runs `pnpm db:migrate` as a release step.
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
