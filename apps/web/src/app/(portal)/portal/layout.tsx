import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";
import { PortalShell } from "./portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();

  return (
    <LocaleProvider key={locale} locale={locale}>
      <PortalShell>{children}</PortalShell>
    </LocaleProvider>
  );
}
