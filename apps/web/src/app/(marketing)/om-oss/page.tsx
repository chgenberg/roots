import { ArrowRight } from "lucide-react";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import { TeamGroupPhoto, TeamPortraits } from "@/components/sections/team";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { RootsGrassDivider } from "@/components/brand";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";
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
  const team = marketingUi[locale].team;
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

      <section className="relative overflow-hidden bg-brand-100 py-20 pb-32 md:py-28 md:pb-40">
        <RootsGrassDivider
          variant="dark"
          className="absolute inset-x-0 bottom-0 opacity-60"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>{t.valuesEyebrow}</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t.valuesTitle}
            </h2>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {t.values.map((v) => (
              <div key={v.title}>
                <h3 className="text-lg font-semibold tracking-tight">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="teamet" className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="max-w-lg">
              <SectionEyebrow>{t.storyEyebrow}</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {t.storyTitle}
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                {t.storyParagraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </div>
            <div className="max-w-lg">
              <SectionEyebrow>{team.badge}</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {team.title}
              </h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                {team.body}
              </p>
            </div>
          </div>

          <div className="mt-16">
            <TeamPortraits />
          </div>
        </div>
      </section>

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

      <section className="px-6 pb-20 md:px-10 md:pb-28">
        <TeamGroupPhoto className="mx-auto max-w-3xl" />
      </section>
    </>
  );
}
