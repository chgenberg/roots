import type { MiddlewareHandler } from "hono";

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  const apiDomain = process.env.CORS_ORIGIN || "http://localhost:3000";

  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `connect-src 'self' ${apiDomain}`,
      "img-src 'self' data:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  c.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  c.header("X-Frame-Options", "DENY");
};
