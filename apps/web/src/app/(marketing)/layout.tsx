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
    <LocaleProvider locale={locale}>
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
