import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";
import { FundraisingShell } from "./fundraising-shell";

export default async function FundraisingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();

  return (
    <LocaleProvider key={locale} locale={locale}>
      <FundraisingShell>{children}</FundraisingShell>
    </LocaleProvider>
  );
}
