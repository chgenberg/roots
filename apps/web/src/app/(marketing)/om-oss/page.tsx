import Image from "next/image";
import { Heart, Leaf, Shield } from "lucide-react";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { TeamSection } from "@/components/sections/team";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

const VALUE_ICONS = [Heart, Leaf, Shield] as const;

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

  const values = t.values.map((v, i) => ({
    ...v,
    icon: VALUE_ICONS[i] ?? Heart,
  }));

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
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#FAF6EF_0%,#F1EBE2_48%,#EDF1E9_100%)]"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 pb-6 pt-20 md:px-10 md:pb-8 md:pt-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">
              {t.eyebrow}
            </p>
            <h1 className="mt-4 text-[length:var(--font-size-hero)] font-bold tracking-tight">
              {t.brand}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t.heroBody}
            </p>
          </div>
        </div>
      </section>

      <TeamSection />

      <section className="py-24 md:py-32">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="relative">
            <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src="/images/sport-paddock.jpg"
                alt={t.storyImageAlt}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-900/10" />
            </div>
          </div>

          <div className="max-w-lg">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              {t.storyEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t.storyTitle}
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              {t.storyParagraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-brand-200/60 bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              {t.valuesEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t.valuesTitle}
            </h2>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {values.map((v) => (
              <div key={v.title} className="text-center md:text-left">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-700/10 md:mx-0">
                  <v.icon className="h-5 w-5 text-brand-700" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-10">
          <div id="press">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              {t.pressEyebrow}
            </p>
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
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              {t.jobsEyebrow}
            </p>
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
