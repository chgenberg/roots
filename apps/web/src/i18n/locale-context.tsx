"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { defaultLocale, type Locale } from "./config";
import { getBrowserLocale } from "./browser-locale";
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
 * - Soft navigation can leave a stale server `locale` prop on shared layouts
 *
 * After mount, the browser URL (`window.location`) is authoritative. During
 * SSR / first paint we trust the middleware-provided prop so hydration matches.
 */
export function LocaleProvider({
  locale: localeProp,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  // Re-render on client navigations; do not use the value for locale itself.
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When already mounted, re-read on every navigation (soft locale switch).
  // `pathname` from usePathname() triggers the re-render; the locale itself
  // comes from window.location because rewrites strip `/en` from usePathname.
  const locale: Locale = mounted
    ? getBrowserLocale()
    : (localeProp ?? defaultLocale);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: chrome[locale],
      href: (path: string) => withLocale(path, locale),
    }),
    // pathname: recompute after client navigations even if locale string matches
    [locale, pathname]
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
