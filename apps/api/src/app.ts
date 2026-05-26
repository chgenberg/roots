import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { trpcHandler } from "./trpc/handler";
import { fortnoxWebhook } from "./routes/fortnox-webhook";
import { aiChat } from "./routes/ai-chat";
import { hairAnalysis } from "./routes/hair-analysis";
import { publicChat } from "./routes/public-chat";
import { auth } from "./routes/auth";
import { shop } from "./routes/shop";
import { checkout } from "./routes/checkout";
import { dashboard } from "./routes/dashboard";
import { settlement } from "./routes/settlement";
import { payoutsRoute } from "./routes/payouts";
import { internalCron } from "./routes/internal-cron";
import { sharing } from "./routes/sharing";
import { bankid } from "./routes/bankid";
import { contact } from "./routes/contact";
import { portal } from "./routes/portal";
import { association } from "./routes/association";
import { sales } from "./routes/sales";
import { admin } from "./routes/admin";
import { notifications } from "./routes/notifications";
import { preview } from "./routes/preview";
import { securityHeaders } from "./middleware/security-headers";
import { generateCsrfToken, verifyCsrfToken } from "./lib/csrf";
import { checkReadiness } from "./lib/health-checks";
import { captureException } from "./lib/sentry";
import { childLogger } from "./lib/logger";
import { getSession, SESSION_COOKIE_NAME as ACTUAL_SESSION_COOKIE_NAME } from "./lib/session";

const errLog = childLogger("hono-error");

export const app = new Hono();

app.use("*", logger());
app.use("*", securityHeaders);

/**
 * MASTERPLAN_01 KC8.8 + Sentry user-context: tagg:a varje request med
 * en kort request-id och, om en session-cookie finns, läs session så
 * vi kan bifoga userId/role till framtida felrapporter.
 *
 * Vi sätter värdena på `c` så `onError` nedan kan plocka ut dem
 * synchronously utan ny Redis-fråga i 500-pathen. Sessionsläsning är
 * best-effort — Redis-fel ska inte blocka requests.
 */
// P2.40 (audit 2026-05-26): cookienamnet här var fel — den faktiska
// sessionscookien heter `rootsSessionId` (se lib/session.ts) men
// Sentry-context-middleware:n läste från `roots_session` så
// userId/role/orgId saknades på alla 500-rapporter. Vi importerar
// nu det auktoritativa namnet från session.ts så de aldrig glider isär.
const SENTRY_SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || ACTUAL_SESSION_COOKIE_NAME;

app.use("*", async (c, next) => {
  // 8 hex chars = 4 bytes; tillräckligt unikt för att korsreferera
  // mellan API-pino-log och Sentry/web-error-toast.
  const reqId =
    c.req.header("x-request-id") ||
    Math.random().toString(16).slice(2, 10);
  c.set("requestId" as never, reqId as never);
  c.header("x-request-id", reqId);

  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SENTRY_SESSION_COOKIE_NAME}=([^;]+)`));
  if (match) {
    try {
      const session = await getSession(match[1]);
      if (session) {
        c.set(
          "sessionUser" as never,
          {
            userId: session.userId,
            role: session.role,
            orgId: session.orgId,
          } as never
        );
      }
    } catch {
      // Redis hick — ignorera så att routen kör vidare. /me-handlern
      // får själva detektera saknad session.
    }
  }

  return next();
});
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3003",
    credentials: true,
  })
);

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = [
  "/v1/integrations/fortnox/webhook",
  // MASTERPLAN_01 KC1.1: Klarna server pushes the order-status update
  // straight to /v1/checkout/webhook/:klarnaOrderId without a CSRF
  // token (it's a server-to-server POST). Without this exemption every
  // payment fastnar PENDING in production. Authentication is enforced
  // by HMAC signature + IP allowlist inside the route handler.
  "/v1/checkout/webhook",
  "/health",
  // Sprint D: Railway/Cloud Run/k8s liveness + readiness probes never
  // carry a CSRF token. They're GET-only so the safe-method check
  // already lets them through, but listing them here documents intent
  // and protects against accidental method changes later.
  "/healthz",
  "/readyz",
  // Preview gate: served before the visitor has the chance to fetch
  // a CSRF token (the gate page is the very first thing they see).
  // Protected instead by per-IP rate limits in routes/preview.ts.
  "/v1/preview/unlock",
  "/v1/preview/waitlist",
  // MASTERPLAN_01 KC2.7 + P3.30 (audit 2026-05-26): interna cron-jobb
  // triggas av Railway cron eller GitHub Actions med Bearer-token.
  // Tidigare exempterades hela /v1/internal/cron-prefixet, vilket gjorde
  // att framtida endpoints under den prefixen automatiskt ärvde CSRF-
  // bypass. Listet är nu explicit per-endpoint så nya rutter måste
  // läggas till medvetet och granskas separat.
  "/v1/internal/cron/deletion-purge",
];

// Pre-push fix 2026-05-26: tidigare användes startsWith vilket gjorde
// att en framtida endpoint som t.ex. /v1/internal/cron/deletion-purge-
// backup automatiskt skulle ärva CSRF-undantaget utan att läggas till
// i listan. Exact match tvingar in oss till medvetna review-beslut.
const CSRF_EXEMPT_PATH_SET = new Set(CSRF_EXEMPT_PATHS);

// Scout fix 2026-05-26 (Auth-H2): tidigare släpptes ALLA muterande
// requests igenom utan token om NODE_ENV !== "production". Det gjorde
// staging/dev trivialt CSRF-bart. Vi enforcar nu alltid när NODE_ENV
// inte är "test" (vitest sätter "test" vid setup), så pnpm dev får
// samma policy som prod. Tester som behöver bypass ska sätta header
// eller köra mot dedikerad fixture.
const CSRF_ENFORCEMENT_DISABLED = process.env.NODE_ENV === "test";

app.use("*", async (c, next) => {
  if (CSRF_SAFE_METHODS.has(c.req.method)) return next();
  if (CSRF_EXEMPT_PATH_SET.has(c.req.path)) return next();

  const token = c.req.header("x-csrf-token");
  if (token && verifyCsrfToken(token)) return next();

  if (CSRF_ENFORCEMENT_DISABLED) return next();
  return c.json({ error: "Invalid or missing CSRF token." }, 403);
});

app.get("/", (c) =>
  c.json({
    name: "Roots Nordic API",
    version: "1.0.0",
    status: "ok",
    docs: "/health",
  })
);

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Sprint D: split the legacy `/health` into Kubernetes-style probes.
// `/health` stays for back-compat with any external monitors.
//
// /healthz — LIVENESS: does the process respond at all? No external
// deps touched so a flapping DB/Redis can NEVER trigger a restart loop.
app.get("/healthz", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// /readyz — READINESS: pings DB + Redis with a strict timeout. 503 if
// either is down so a load balancer can drain the instance.
app.get("/readyz", async (c) => {
  const report = await checkReadiness();
  return c.json(
    { status: report.ok ? "ok" : "degraded", ...report },
    report.ok ? 200 : 503
  );
});

app.get("/v1/csrf-token", (c) => {
  return c.json({ token: generateCsrfToken() });
});

app.route("/v1/auth", auth);
app.route("/v1/shop", shop);
app.route("/v1/checkout", checkout);
app.route("/v1/dashboard", dashboard);
app.route("/v1/settlement", settlement);
app.route("/v1/payouts", payoutsRoute);
app.route("/v1/internal/cron", internalCron);
app.route("/v1/sharing", sharing);
app.route("/v1/bankid", bankid);
app.route("/v1/contact", contact);
app.route("/v1/portal", portal);
app.route("/v1/association", association);
app.route("/v1/sales", sales);
app.route("/v1/admin", admin);
app.route("/v1/notifications", notifications);
app.route("/v1/preview", preview);
app.route("/v1/integrations/fortnox", fortnoxWebhook);

const v1Ai = new Hono();
v1Ai.route("/", aiChat);
v1Ai.route("/", hairAnalysis);
v1Ai.route("/", publicChat);
app.route("/v1/ai", v1Ai);

app.all("/trpc/*", trpcHandler);

// Sprint D+1: central error handler. Hono swallows route exceptions by
// default and returns 500 with no body — opaque both for users and for
// our incident response. We:
//   1. Log a single structured pino line so it shows up in Railway.
//   2. Forward to Sentry with route + method tags for grouping.
//   3. Return a stable JSON shape so the frontend's `apiFetch` can
//      surface a non-empty `error` field.
// We intentionally do NOT leak the original error message in
// production — could expose stack/internal table names.
app.onError((err, c) => {
  const isProd = process.env.NODE_ENV === "production";
  const reqId = c.get("requestId" as never) as string | undefined;
  const sessionUser = c.get("sessionUser" as never) as
    | { userId: string; role: string; orgId: string | null }
    | undefined;

  errLog.error(
    {
      err,
      path: c.req.path,
      method: c.req.method,
      reqId,
      userId: sessionUser?.userId,
      role: sessionUser?.role,
    },
    "unhandled route error"
  );

  // MASTERPLAN_01 KC8 ops-hardening: enrich Sentry-events med
  // request-id + (när inloggad) userId/role/orgId. Tidigare gav
  // Sentry en helt anonymisera-d 500 utan vägen tillbaka till
  // användarens incident-ticket; nu kan supporten klistra in
  // x-request-id-headern och hitta exakt event.
  captureException(err, {
    tags: {
      route: c.req.path,
      method: c.req.method,
      ...(reqId ? { reqId } : {}),
      ...(sessionUser?.role ? { role: sessionUser.role } : {}),
    },
    extra: {
      ...(sessionUser
        ? {
            userId: sessionUser.userId,
            orgId: sessionUser.orgId,
          }
        : {}),
    },
  });
  return c.json(
    {
      error: isProd
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : String(err),
      ...(reqId ? { requestId: reqId } : {}),
    },
    500
  );
});

export type AppType = typeof app;
