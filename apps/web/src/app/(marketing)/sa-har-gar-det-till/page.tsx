import type { Metadata } from "next";
import {
  ArrowRight,
  BellOff,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Megaphone,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/components/locale-link";
import { CopyTextButton } from "@/components/copy-text-button";
import { HowItWorksFlowImage, HowItWorksStrip } from "@/components/how-it-works-flows";
import { BreadcrumbJsonLd, FaqJsonLd, HowToJsonLd } from "@/components/json-ld";
import { howItWorks, type SkipIcon } from "@/i18n/dictionaries/how-it-works";
import { getPage } from "@/i18n/get-dictionary";
import { withLocale } from "@/i18n/paths";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const PATH = "/sa-har-gar-det-till";

const SKIP_ICONS: Record<SkipIcon, LucideIcon> = {
  orders: ClipboardList,
  payments: CreditCard,
  reminders: BellOff,
  sorting: PackageCheck,
  home: Truck,
  results: ChartColumn,
  material: Megaphone,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = howItWorks[locale];
  return pageMetadata({
    title: t.metaTitle,
    description: t.metaDescription,
    path: PATH,
    locale,
  });
}

export default async function SaHarGarDetTillPage() {
  const locale = await getRequestLocale();
  const t = howItWorks[locale];
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale(PATH, locale) },
        ]}
      />
      <HowToJsonLd
        name={t.title}
        description={t.body}
        url={withLocale(PATH, locale)}
        steps={t.steps.map((s) => ({ name: s.title, text: [s.lead, ...s.body].join(" ") }))}
      />
      <FaqJsonLd faqs={t.faqs} />

      <section className="pb-12 pt-14 md:pb-16 md:pt-20">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl tracking-tight md:text-5xl">{t.title}</h1>
            <p className="mt-4 text-xl md:text-2xl">{t.lead}</p>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {t.body}
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild>
                <LocaleLink href="/sa-fungerar-det#rakna">
                  {t.heroCta}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </LocaleLink>
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-14 max-w-4xl">
            <HowItWorksStrip locale={locale} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] space-y-20 px-6 pb-20 md:space-y-28 md:px-10 md:pb-28">
        {t.steps.map((step, i) => (
          <section
            key={step.flow}
            id={`steg-${i + 1}`}
            aria-labelledby={`steg-${i + 1}-titel`}
            className="grid scroll-mt-28 items-center gap-8 md:grid-cols-2 md:gap-14"
          >
            <div className={cn(i % 2 === 1 && "md:order-2")}>
              <p className="font-display text-5xl font-semibold text-brand-700" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 id={`steg-${i + 1}-titel`} className="mt-3 text-3xl tracking-tight">
                {step.title}
              </h2>
              <p className="mt-2 text-lg font-medium">{step.lead}</p>
              <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
                {step.body.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
              {step.options && (
                <dl className="mt-5 space-y-4">
                  {step.options.map((o) => (
                    <div key={o.title} className="border-l-2 border-brand-300 pl-4">
                      <dt className="font-semibold">{o.title}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{o.body}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {step.note && <p className="mt-5 text-sm font-medium">{step.note}</p>}
              {step.cta &&
                (step.cta.href.startsWith("#") ? (
                  <a
                    href={step.cta.href}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:no-underline"
                  >
                    {step.cta.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                ) : (
                  <Button className="mt-6" asChild>
                    <LocaleLink href={step.cta.href}>
                      {step.cta.label}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </LocaleLink>
                  </Button>
                ))}
            </div>
            <div className={cn(i % 2 === 1 && "md:order-1")}>
              <HowItWorksFlowImage flow={step.flow} locale={locale} />
            </div>
          </section>
        ))}
      </div>

      <section aria-labelledby="slipper-titel" className="pb-20 md:pb-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] px-6 py-12 sm:px-10 md:py-16">
            <h2 id="slipper-titel" className="text-center text-3xl tracking-tight">
              {t.skipTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-lg text-muted-foreground">
              {t.skipIntro}
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.skip.map((item) => {
                const Icon = SKIP_ICONS[item.icon];
                return (
                  <li
                    key={item.title}
                    className="flex flex-col rounded-2xl bg-white/85 p-6 shadow-sm shadow-brand-900/5 ring-1 ring-brand-700/10"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold leading-snug">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </li>
                );
              })}
              <li className="flex flex-col justify-end rounded-2xl bg-brand-700 p-6 text-white">
                <h3 className="text-lg font-semibold leading-snug">{t.skipSummaryTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{t.skipSummaryBody}</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-2xl px-6 text-center md:px-10">
          <h2 className="text-3xl tracking-tight">{t.allTheWayTitle}</h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {t.allTheWayBody}
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" asChild>
              <LocaleLink href="/intresseanmalan">
                {t.allTheWayCta}
                <ArrowRight className="ml-1 h-4 w-4" />
              </LocaleLink>
            </Button>
          </div>
        </div>
      </section>

      <section id="tips" className="scroll-mt-28 border-t border-brand-200/70 py-20 md:py-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl tracking-tight">{t.tipsTitle}</h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              {t.tipsIntro}
            </p>
          </div>
          <ol className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {t.tips.map((tip, i) => (
              <li key={tip.title}>
                <p className="text-sm font-semibold text-brand-700">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-lg font-semibold">{tip.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
              </li>
            ))}
          </ol>

          <div className="mx-auto mt-16 max-w-2xl rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{t.messageTitle}</h3>
              <CopyTextButton text={t.message} label={t.copy} copiedLabel={t.copied} />
            </div>
            <blockquote className="mt-4 rounded-2xl bg-white/80 p-5 text-base leading-relaxed">
              {t.message}
            </blockquote>
          </div>
        </div>
      </section>

      <section className="border-t border-brand-200/70 py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-6 md:px-10">
          <h2 className="text-center text-3xl tracking-tight">{t.faqTitle}</h2>
          <div className="mt-10 divide-y divide-brand-200/70 border-y border-brand-200/70">
            {t.faqs.map((faq) => (
              <details key={faq.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Button size="lg" asChild>
              <LocaleLink href="/intresseanmalan">
                {t.allTheWayCta}
                <ArrowRight className="ml-1 h-4 w-4" />
              </LocaleLink>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
