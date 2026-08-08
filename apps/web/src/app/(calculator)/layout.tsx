import type { Metadata } from "next";
import Link from "next/link";
import { LegalIdentityBlock } from "@/components/legal-identity-block";

/**
 * Layout för den publika föreningskalkylatorn (/kalkylator/[token]).
 * Avsiktligt minimal — ingen portal- eller marknadsföringschrome — så
 * föreningen kan fokusera på sin egen uträkning. Tunn juridisk footer
 * speglar shop-layouten.
 *
 * Token-URL:er ska inte indexeras (defense-in-depth utöver robots.txt).
 */
export const metadata: Metadata = {
  title: "Intäktskalkylator",
  description:
    "Räkna på vad föreningsförsäljning med Roots kan ge er förening.",
  robots: { index: false, follow: false },
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-50/30">
      {/* Mål för skip-länken i root layout — se kommentaren i (shop)/layout.tsx.
          Kalkylatorn saknade både <main> och id, så skip-länken var död här. */}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <LegalIdentityBlock variant="compact" showContact />
            <nav aria-label="Juridiskt" className="flex items-center gap-4">
              <Link
                href="/integritet"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Integritetspolicy
              </Link>
              <Link
                href="/kontakt"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Kontakt
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
