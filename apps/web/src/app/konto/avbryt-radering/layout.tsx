import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cancelDeletion } from "@/i18n/dictionaries/errors";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = cancelDeletion[locale];
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function CancelDeletionLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getRequestLocale();
  return (
    <LocaleProvider key={locale} locale={locale}>
      {children}
    </LocaleProvider>
  );
}
