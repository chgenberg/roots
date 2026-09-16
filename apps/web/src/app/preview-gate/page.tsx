import type { Metadata } from "next";
import { Suspense } from "react";
import { GateRoom, GateWordmark } from "@/components/gate-room";
import { getPreview } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";
import { PreviewGateForm } from "./preview-gate-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPreview(locale);
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
  const t = getPreview(locale);

  return (
    <LocaleProvider key={locale} locale={locale}>
      <GateRoom>
        <div className="rounded-3xl bg-card px-8 py-8 shadow-[var(--shadow-dialog)] sm:px-9 sm:py-9">
          <GateWordmark />

          <div className="mt-7 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t.eyebrow}
            </p>
            <h1 className="mt-2.5 text-pretty text-[1.6rem] font-bold leading-[1.2] tracking-tight sm:text-3xl">
              {t.titleLine1}
              <br />
              {t.titleLine2}
            </h1>
            <p className="mt-3.5 text-pretty text-sm leading-relaxed text-muted-foreground">
              {t.body}
            </p>
          </div>

          <div className="mt-7">
            <Suspense fallback={null}>
              <PreviewGateForm />
            </Suspense>
          </div>
        </div>
      </GateRoom>
    </LocaleProvider>
  );
}
