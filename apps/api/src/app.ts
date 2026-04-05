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
import { sharing } from "./routes/sharing";
import { bankid } from "./routes/bankid";
import { contact } from "./routes/contact";
import { portal } from "./routes/portal";
import { securityHeaders } from "./middleware/security-headers";
import { generateCsrfToken, verifyCsrfToken } from "./lib/csrf";

export const app = new Hono();

app.use("*", logger());
app.use("*", securityHeaders);
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
  "/health",
];

app.use("*", async (c, next) => {
  if (CSRF_SAFE_METHODS.has(c.req.method)) return next();
  if (CSRF_EXEMPT_PATHS.some((p) => c.req.path.startsWith(p))) return next();

  const token = c.req.header("x-csrf-token");
  if (token && verifyCsrfToken(token)) return next();

  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Invalid or missing CSRF token." }, 403);
  }
  return next();
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

app.get("/v1/csrf-token", (c) => {
  return c.json({ token: generateCsrfToken() });
});

app.route("/v1/auth", auth);
app.route("/v1/shop", shop);
app.route("/v1/checkout", checkout);
app.route("/v1/dashboard", dashboard);
app.route("/v1/settlement", settlement);
app.route("/v1/sharing", sharing);
app.route("/v1/bankid", bankid);
app.route("/v1/contact", contact);
app.route("/v1/portal", portal);
app.route("/v1/integrations/fortnox", fortnoxWebhook);

const v1Ai = new Hono();
v1Ai.route("/", aiChat);
v1Ai.route("/", hairAnalysis);
v1Ai.route("/", publicChat);
app.route("/v1/ai", v1Ai);

app.all("/trpc/*", trpcHandler);

export type AppType = typeof app;
