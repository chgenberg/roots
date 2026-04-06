/**
 * Browser API base URL. Use the same-origin `/api` proxy so `rootsSessionId` is a
 * first-party cookie (cross-subdomain API cookies are often dropped).
 *
 * In the browser we always use `/api` so a wrong `NEXT_PUBLIC_*` baked at build
 * time cannot point requests at the API host (which breaks cookies).
 *
 * On the server (SSR), `NEXT_PUBLIC_API_URL` may be set to an absolute URL.
 */
export function getBrowserApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "/api";
}
