import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat-widget";
import { SearchDialog } from "@/components/search-dialog";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();

  return (
    // key forces chrome to remount when middleware locale changes, so a
    // soft switch between `/` and `/en` cannot leave Swedish nav labels
    // on an English page (rewrite makes both map to the same segment).
    <LocaleProvider key={locale} locale={locale}>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <ChatWidget />
      <SearchDialog />
    </LocaleProvider>
  );
}
