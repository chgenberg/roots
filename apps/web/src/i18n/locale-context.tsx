"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { defaultLocale, type Locale } from "./config";
import {
  getBrowserLocale,
  subscribeBrowserUrl,
} from "./browser-locale";
import { withLocale } from "./paths";
import { chrome } from "./dictionaries/chrome";

type LocaleContextValue = {
  locale: Locale;
  t: (typeof chrome)[Locale];
  href: (path: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Resolve active UI locale.
 *
 * Middleware rewrites `/en/...` → `/...` for App Router matching. That means:
 * - Server Components get the right locale via `x-roots-locale`
 * - `usePathname()` often returns the *rewritten* path (`/`), not `/en`
 * - Soft navigation between `/page` and `/en/page` may not remount layouts
 *
 * On the client we subscribe to the real browser URL (History API), not the
 * rewritten pathname, so chrome (nav/footer/switcher) always tracks locale.
 * During SSR we trust the middleware-provided prop so hydration matches.
 */
export function LocaleProvider({
  locale: localeProp,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const serverLocale = localeProp ?? defaultLocale;
  const locale = useSyncExternalStore(
    subscribeBrowserUrl,
    getBrowserLocale,
    () => serverLocale
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: chrome[locale],
      href: (path: string) => withLocale(path, locale),
    }),
    [locale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  // Fallback for components outside the provider (should be rare).
  // On the client, prefer the browser URL over hardcoding Swedish.
  const locale =
    typeof window !== "undefined" ? getBrowserLocale() : defaultLocale;
  return {
    locale,
    t: chrome[locale],
    href: (path: string) => withLocale(path, locale),
  };
}
