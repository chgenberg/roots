import type { ReactNode } from "react";
import { LocaleLink } from "@/components/locale-link";
import { RootsLogo } from "@/components/brand";
import { getAuth } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const t = getAuth("layout", locale);

  return (
    <LocaleProvider locale={locale}>
      <div className="flex min-h-screen flex-col bg-brand-50/30">
        <header className="flex h-16 items-center px-6">
          <LocaleLink
            href="/"
            aria-label={t.ariaHome}
            className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
          >
            <RootsLogo variant="auto" className="h-7 w-[70px]" />
          </LocaleLink>
        </header>
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center px-6 pb-16 animate-fade-in"
        >
          {children}
        </main>
      </div>
    </LocaleProvider>
  );
}
