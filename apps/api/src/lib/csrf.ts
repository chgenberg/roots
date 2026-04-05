import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.CSRF_SECRET || "dev-csrf-secret";

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
  return expected === provided;
}
