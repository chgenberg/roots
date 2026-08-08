import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";
import { ArrowRight, Users, ShieldCheck, Truck, BarChart3 } from "lucide-react";

const FEATURE_ICONS = [Users, ShieldCheck, Truck, BarChart3] as const;

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

  const features = t.features.map((f, i) => ({
    ...f,
    icon: FEATURE_ICONS[i] ?? Users,
  }));

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
      <section className="relative overflow-hidden bg-brand-50/40 py-20 md:py-28">
        <div
          className="pointer-events-none absolute -bottom-20 left-[10%] h-40 w-40 rounded-full border border-brand-200/30 animate-float motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-lg">
            <Badge variant="secondary" className="mb-4">
              {t.badge}
            </Badge>
            <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.05] tracking-tight">
              {t.heroTitleLead}
              <span className="block text-brand-500">{t.heroTitleAccent}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t.heroBody}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" pulse asChild>
                <LocaleLink href="/registrera" localeNeutral>
                  {t.ctaPrimary}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </LocaleLink>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <LocaleLink href="/kontakt">{t.ctaSecondary}</LocaleLink>
              </Button>
            </div>
          </div>

          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl shadow-brand-900/10">
            <Image
              src="/images/sport-hockey.jpg"
              alt={t.heroImageAlt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
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
                  className="text-5xl font-bold text-brand-200"
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
        </div>
      </section>

      <section className="px-6 md:px-10">
        <div className="group relative mx-auto max-w-[1280px] overflow-hidden rounded-3xl">
          <div className="relative aspect-[16/10]">
            <Image
              src="/images/sport-hero.jpg"
              alt={t.midImageAlt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="100vw"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              {t.featuresTitle}
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card
                key={f.title}
                className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                    <f.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-inverse-surface py-16 text-inverse-on-surface md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight">{t.bottomTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-inverse-on-surface/80">
            {t.bottomBody}
          </p>
          <Button
            size="lg"
            className="mt-8 bg-white text-neutral-900 shadow-sm hover:bg-neutral-100"
            asChild
          >
            <LocaleLink href="/registrera" localeNeutral>
              {t.bottomCta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
        </div>
      </section>
    </>
  );
}
