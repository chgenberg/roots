"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { defaultLocale, type Locale } from "./config";
import { getLocaleFromPathname, withLocale } from "./paths";
import { chrome } from "./dictionaries/chrome";

type LocaleContextValue = {
  locale: Locale;
  t: (typeof chrome)[Locale];
  href: (path: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale: localeProp,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const locale = localeProp ?? getLocaleFromPathname(pathname);

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
  return {
    locale: defaultLocale,
    t: chrome[defaultLocale],
    href: (path: string) => withLocale(path, defaultLocale),
  };
}
