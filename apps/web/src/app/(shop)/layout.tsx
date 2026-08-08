import { LocaleLink } from "@/components/locale-link";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { getShop } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

/**
 * Shop (supporter) layout wraps /shop/[slug]/* pages with a thin footer
 * exposing legal info. The seller's main CTA is the sticky cart bar, so the
 * footer is deliberately minimal and does not compete visually.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = getShop("footer", locale);

  return (
    <LocaleProvider key={locale} locale={locale}>
      <div className="flex min-h-screen flex-col">
        {/* Målet för skip-länken i root layout. Den pekade tidigare på ett id
          som inte fanns i den här route-gruppen, så "Hoppa till innehåll"
          gjorde ingenting i hela butiken — alltså på de sidor där en
          supporter faktiskt betalar.

          Id:t sitter på wrappern och inte på ett <main>, eftersom varje
          shop-sida redan har sin egen <main> för respektive tillstånd
          (laddar, fel, normal). Nästlade <main> är ogiltig HTML, och att
          lägga id:t på alla åtta vore något att glömma nästa gång någon
          lägger till en sida. tabIndex behövs för att fokus ska flytta —
          en div är inte fokuserbar av sig själv. */}
        <div id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </div>
        <footer className="border-t bg-background">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LegalIdentityBlock variant="compact" showContact />
              <nav
                aria-label={t.legalNavAria}
                className="flex items-center gap-4"
              >
                <LocaleLink
                  href="/villkor"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t.terms}
                </LocaleLink>
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
