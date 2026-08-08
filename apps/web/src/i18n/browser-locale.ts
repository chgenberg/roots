import type { Locale } from "./config";
import { defaultLocale } from "./config";

/** Read active UI locale from the browser URL (`/en/...` → en). */
export function getBrowserLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const path = window.location.pathname || "/";
  return path === "/en" || path.startsWith("/en/") ? "en" : defaultLocale;
}

/** Headers that tell the API which UI language to use for errors/names. */
export function localeHeaders(
  init?: HeadersInit
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-roots-locale": getBrowserLocale(),
  };
  if (!init) return headers;
  const existing = new Headers(init);
  existing.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}
