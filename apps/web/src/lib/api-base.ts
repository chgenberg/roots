/**
 * Browser API base URL. Use the same-origin `/api` proxy so `rootsSessionId` is a
 * first-party cookie (cross-subdomain API cookies are often dropped).
 *
 * Production: set `NEXT_PUBLIC_API_URL` to `https://<your-web-host>/api`
 * Local: defaults to `/api` (Next route handlers proxy to `API_BACKEND_URL`).
 */
export function getBrowserApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "/api";
}
