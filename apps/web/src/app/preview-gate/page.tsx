import type { Metadata } from "next";
import { Suspense } from "react";
import { InterestSplit } from "@/components/interest-split";
import { getInterest } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";
import { PreviewGateForm } from "./preview-gate-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getInterest(locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
  };
}

// Standalone page — deliberately outside the marketing layout (no header,
// no footer) so the gate really blocks the site instead of framing it.
export default async function PreviewGatePage() {
  const locale = await getRequestLocale();

  return (
    <LocaleProvider key={locale} locale={locale}>
      <InterestSplit locale={locale} standalone>
        <Suspense fallback={null}>
          <PreviewGateForm />
        </Suspense>
      </InterestSplit>
    </LocaleProvider>
  );
}
