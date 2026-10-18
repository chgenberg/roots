import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { SkipGrid } from "@/components/sections/skip-grid";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("foreningsliv", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/foreningsliv",
    locale,
  });
}

export default async function ForeningslivPage() {
  const locale = await getRequestLocale();
  const t = getPage("foreningsliv", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/foreningsliv", locale) },
        ]}
      />
      <WebPageJsonLd
        name={t.title}
        description={t.description}
        url={withLocale("/foreningsliv", locale)}
        locale={locale}
      />

      <section className="py-14 md:py-20">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-lg">
            <p className="mb-8 text-pretty text-lg leading-relaxed">{t.heroIntro}</p>
            <h1 className="text-3xl leading-[1.15] tracking-tight md:text-4xl">
              {t.heroTitleLead}
              <span className="block text-brand-700">{t.heroTitleAccent}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t.heroBody}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" pulse asChild>
                <LocaleLink href="/intresseanmalan">
                  {t.ctaPrimary}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <LocaleLink href="/sa-fungerar-det#rakna">{t.ctaCalc}</LocaleLink>
              </Button>
            </div>
          </div>

          <div className="group relative aspect-[5/4] overflow-hidden rounded-3xl shadow-2xl shadow-brand-900/10 md:aspect-[4/3]">
            <Image
              src="/images/sport/ishockey-foto.jpg"
              alt={t.heroImageAlt}
              fill
              className="object-cover object-[center_45%] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t.stepsTitle}</h2>
            <p className="mt-4 text-muted-foreground">{t.stepsSubtitle}</p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-4">
            {t.steps.map((s) => (
              <div key={s.step} className="relative">
                <span
                  className="font-display text-5xl font-semibold text-brand-700"
                  aria-hidden="true"
                >
                  {s.step}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <LocaleLink href="/sa-fungerar-det#rakna">
                {t.ctaAfterSteps}
                <ArrowRight className="ml-1 h-4 w-4" />
              </LocaleLink>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <LocaleLink href="/sa-har-gar-det-till">{t.ctaHowTo}</LocaleLink>
            </Button>
          </div>
        </div>
      </section>

      <SkipGrid />

      <section className="px-6 pb-24 md:px-10 md:pb-32">
        <div className="group relative mx-auto max-w-[1280px] overflow-hidden rounded-3xl">
          <div className="relative aspect-[4/5] md:aspect-[16/10]">
            <Image
              src="/images/sport/fotboll-match-foto.jpg"
              alt={t.midImageAlt}
              fill
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02] md:hidden"
              sizes="100vw"
            />
            <Image
              src="/images/sport/fotboll-match-foto.jpg"
              alt={t.midImageAlt}
              fill
              className="hidden object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] md:block"
              sizes="100vw"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[1280px] px-6 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight">{t.bottomTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {t.bottomBody}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <LocaleLink href="/intresseanmalan">
                {t.bottomCta}
                <ArrowRight className="ml-1 h-4 w-4" />
              </LocaleLink>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <LocaleLink href="/sa-fungerar-det#rakna">
                {t.bottomCalcCta}
              </LocaleLink>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
