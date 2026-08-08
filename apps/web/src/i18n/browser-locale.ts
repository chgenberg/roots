import type { Locale } from "./config";
import { defaultLocale } from "./config";

/** Read active UI locale from the browser URL (`/en/...` → en). */
export function getBrowserLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const path = window.location.pathname || "/";
  return path === "/en" || path.startsWith("/en/") ? "en" : defaultLocale;
}

/**
 * Subscribe to real browser URL changes.
 *
 * Next.js middleware rewrites `/en/...` → `/...`, so `usePathname()` often
 * stays identical when switching locale. Soft navigations still update
 * `window.location` via the History API — we listen there.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let historyPatched = false;

function notifyBrowserUrlListeners() {
  for (const listener of listeners) listener();
}

function ensureHistoryPatch() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  const { pushState, replaceState } = window.history;
  window.history.pushState = function (
    ...args: Parameters<History["pushState"]>
  ) {
    const result = pushState.apply(this, args);
    notifyBrowserUrlListeners();
    return result;
  };
  window.history.replaceState = function (
    ...args: Parameters<History["replaceState"]>
  ) {
    const result = replaceState.apply(this, args);
    notifyBrowserUrlListeners();
    return result;
  };
  window.addEventListener("popstate", notifyBrowserUrlListeners);
}

/** Notify locale subscribers (e.g. after a programmatic locale switch). */
export function notifyBrowserUrlChange() {
  notifyBrowserUrlListeners();
}

export function subscribeBrowserUrl(onStoreChange: () => void): () => void {
  ensureHistoryPatch();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

// Patch as soon as this module loads in the browser so we wrap History
// before soft navigations from the language switcher.
if (typeof window !== "undefined") {
  ensureHistoryPatch();
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
