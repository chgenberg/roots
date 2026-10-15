import { ArrowRight } from "lucide-react";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("omOss", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/om-oss",
    locale,
  });
}

export default async function OmOssPage() {
  const locale = await getRequestLocale();
  const t = getPage("omOss", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/om-oss", locale) },
        ]}
      />
      <WebPageJsonLd
        type="AboutPage"
        name={t.title}
        description={t.description}
        url={withLocale("/om-oss", locale)}
        locale={locale}
      />

      <section className="relative overflow-hidden bg-brand-50 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
            <h1 className="mt-3 text-4xl tracking-tight md:text-5xl">
              {t.brand}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t.heroBody}
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                pulse
                asChild
                className="group rounded-full px-8 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
              >
                <LocaleLink href="/kontakt">
                  {t.ctaContact}
                  <ArrowRight className="ml-0.5 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </LocaleLink>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl space-y-16 px-6 py-20 md:space-y-20 md:px-10 md:py-28">
        {t.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-3xl tracking-tight">{section.title}</h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="border-t border-brand-200/60 py-20 md:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-10">
          <div id="press">
            <SectionEyebrow>{t.pressEyebrow}</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              {t.pressTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t.pressBodyBefore}{" "}
              <a
                href={`mailto:${t.pressEmail}`}
                className="font-medium text-foreground underline decoration-brand-400 underline-offset-4 transition-colors hover:decoration-brand-700"
              >
                {t.pressEmail}
              </a>
              .
            </p>
          </div>
          <div id="jobb">
            <SectionEyebrow>{t.jobsEyebrow}</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              {t.jobsTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t.jobsBodyBefore}{" "}
              <a
                href={`mailto:${t.jobsEmail}`}
                className="font-medium text-foreground underline decoration-brand-400 underline-offset-4 transition-colors hover:decoration-brand-700"
              >
                {t.jobsEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

    </>
  );
}
