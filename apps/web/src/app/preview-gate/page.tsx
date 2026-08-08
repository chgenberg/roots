import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { RootsLogo } from "@/components/brand";
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:py-12">
        <Image
          src="/images/sport-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover blur-[2px]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-brand-900/55 via-brand-900/45 to-brand-900/70"
        />

        <div className="animate-slide-up relative w-full max-w-[26rem]">
          <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-dialog)] sm:p-9">
            <div className="flex justify-center">
              <RootsLogo
                variant="auto"
                className="h-10 w-[100px] sm:h-11 sm:w-[110px]"
                priority
              />
            </div>

            <div className="mt-7 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t.eyebrow}
              </p>
              <h1 className="mt-2.5 text-[1.6rem] font-bold leading-[1.15] tracking-tight sm:text-3xl">
                {t.titleLine1}
                <br />
                {t.titleLine2}
              </h1>
              <p className="mx-auto mt-3.5 max-w-[19rem] text-sm leading-relaxed text-muted-foreground">
                {t.body}
              </p>
            </div>

            <div className="mt-7">
              <Suspense fallback={null}>
                <PreviewGateForm />
              </Suspense>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0/45%)]">
            © {new Date().getFullYear()} Roots Nordic AB
          </p>
        </div>
      </div>
    </LocaleProvider>
  );
}
