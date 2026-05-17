import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Connection-audit P1 #7: fail fast in production if CSRF_SECRET is unset.
// The fallback "dev-csrf-secret" produces predictable tokens — fine for
// `npm run dev`, catastrophic in prod (anyone can mint a valid token).
const ENV_SECRET = process.env.CSRF_SECRET;
if (process.env.NODE_ENV === "production" && !ENV_SECRET) {
  throw new Error(
    "CSRF_SECRET must be set in production — refusing to start with the dev fallback secret."
  );
}
const SECRET = ENV_SECRET || "dev-csrf-secret";

export function generateCsrfToken(): string {
  const salt = randomBytes(16).toString("hex");
  const hmac = createHmac("sha256", SECRET).update(salt).digest("hex");
  return `${salt}.${hmac}`;
}

export function verifyCsrfToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [salt, provided] = parts;
  const expected = createHmac("sha256", SECRET).update(salt).digest("hex");
  // Constant-time comparison — string === leaks timing on long mismatches.
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
