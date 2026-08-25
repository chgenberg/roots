import type { ReactNode } from "react";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function FeedbackLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  return (
    <LocaleProvider key={locale} locale={locale}>
      {children}
    </LocaleProvider>
  );
}
