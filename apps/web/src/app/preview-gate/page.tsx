import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
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
  const year = new Date().getFullYear();

  return (
    <LocaleProvider key={locale} locale={locale}>
      <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-2">
        <div className="relative h-52 sm:h-72 lg:order-2 lg:sticky lg:top-0 lg:h-[100dvh]">
          <Image
            src="/images/roots-club-table-w.jpg"
            alt={t.imageAlt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-[50%_40%]"
          />
        </div>

        <main className="flex flex-col px-6 pb-8 pt-8 sm:px-10 lg:min-h-[100dvh] lg:px-14 lg:pt-10 xl:px-20">
          <RootsLogo variant="auto" className="h-9 w-[90px]" priority />

          <div className="mt-8 w-full max-w-md lg:my-auto lg:py-10">
            <h1 className="text-pretty text-[1.75rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.125rem]">
              {t.title}
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {t.body}
            </p>

            <div className="mt-7">
              <Suspense fallback={null}>
                <PreviewGateForm />
              </Suspense>
            </div>
          </div>

          <p className="mt-10 text-xs text-muted-foreground">© {year} Ourroots AB</p>
        </main>
      </div>
    </LocaleProvider>
  );
}
