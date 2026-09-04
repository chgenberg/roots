"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { Card, CardContent } from "@/components/ui/card";
import { HairAnalysisLeadDialog } from "@/components/hair-analysis-lead-dialog";
import {
  Camera,
  Brain,
  Sparkles,
  CheckCircle2,
  Leaf,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { RootsGrassAccent } from "@/components/brand";
import { useLocale } from "@/i18n/locale-context";
import { pages } from "@/i18n/dictionaries/pages";

const OVERVIEW_ICONS = [Camera, Brain, Sparkles] as const;
const BENEFIT_ICONS = [CheckCircle2, Leaf, Sparkles] as const;

// Medan HAIR_ANALYSIS_ENABLED är false nås den här sidan aldrig — middleware:n
// skickar /haranalys vidare till startsidan. Gaten ligger där och inte här
// eftersom notFound() i en klientkomponent hinner få statusen 200 skickad
// innan strömningen avbryts, vilket ger en mjuk 404.
export default function HaranalysPage() {
  const { locale } = useLocale();
  const t = pages.haranalys[locale];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <>
      <section className="relative overflow-hidden bg-brand-50/40 py-24 md:py-32">
        <RootsGrassAccent className="left-[6%] top-[12%]" />
        <RootsGrassAccent variant="neutral" className="bottom-[6%] right-[4%]" />

        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow className="mb-4">{t.badge}</SectionEyebrow>
            <h1 className="text-3xl tracking-tight md:text-4xl">
              {t.heroTitle}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t.heroBody}
            </p>
            <div className="mt-10">
              <HairAnalysisLeadDialog
                trigger={
                  <Button size="lg" pulse className="text-base">
                    {t.ctaStart}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-3xl gap-6 md:grid-cols-3">
            {t.overviewSteps.map((s, i) => {
              const Icon = OVERVIEW_ICONS[i] ?? Camera;
              return (
                <div
                  key={s.title}
                  className="flex flex-col items-center text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-card-foreground shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              {t.benefitsTitle}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.benefitsSubtitle}
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? Sparkles;
              return (
                <Card
                  key={b.title}
                  className="border-0 bg-brand-50/40 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl"
                >
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-card-foreground">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {b.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow className="mb-4">{t.howBadge}</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight">{t.howTitle}</h2>
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-10">
            {t.howSteps.map((step) => (
              <div key={step.num} className="flex items-start gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">
                  {step.num}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <HairAnalysisLeadDialog
              trigger={
                <Button size="lg" pulse>
                  {t.ctaStartNow}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-5xl font-bold tracking-tight md:text-6xl">
              {t.socialProofCount}
            </p>
            <p className="text-lg text-muted-foreground">{t.socialProofLabel}</p>
          </div>
        </div>
      </section>

      <section className="bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t.faqTitle}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.faqSubtitle}</p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl space-y-3">
            {t.faqs.map((faq, i) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-border bg-card text-card-foreground transition-shadow hover:shadow-sm"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-medium">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t.bottomTitle}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.bottomBody}</p>
            <div className="mt-8">
              <HairAnalysisLeadDialog
                trigger={
                  <Button size="lg" pulse className="text-base">
                    {t.bottomCta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: t.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.a,
              },
            })),
          }),
        }}
      />
    </>
  );
}
