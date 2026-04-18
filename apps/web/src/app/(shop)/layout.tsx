import Link from "next/link";
import { LegalIdentityBlock } from "@/components/legal-identity-block";

/**
 * Shop (supporter) layout wraps /shop/[slug]/* pages with a thin footer
 * exposing legal info. The seller's main CTA is the sticky cart bar, so the
 * footer is deliberately minimal and does not compete visually.
 */
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <LegalIdentityBlock variant="compact" showContact />
            <nav aria-label="Juridiskt" className="flex items-center gap-4">
              <Link
                href="/villkor"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Köpvillkor
              </Link>
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
