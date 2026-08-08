import type { Metadata } from "next";
import { LocaleLink } from "@/components/locale-link";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { getPage } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

/**
 * Layout för den publika föreningskalkylatorn (/kalkylator/[token]).
 * Avsiktligt minimal — ingen portal- eller marknadsföringschrome — så
 * föreningen kan fokusera på sin egen uträkning. Tunn juridisk footer
 * speglar shop-layouten.
 *
 * Token-URL:er ska inte indexeras (defense-in-depth utöver robots.txt).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("kalkylatorShare", locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = getPage("kalkylatorShare", locale);

  return (
    <LocaleProvider key={locale} locale={locale}>
      <div className="flex min-h-screen flex-col bg-brand-50/30">
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="border-t bg-background">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LegalIdentityBlock variant="compact" showContact />
              <nav
                aria-label={t.legalNavAria}
                className="flex items-center gap-4"
              >
                <LocaleLink
                  href="/integritet"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t.privacy}
                </LocaleLink>
                <LocaleLink
                  href="/kontakt"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t.contact}
                </LocaleLink>
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </LocaleProvider>
  );
}
