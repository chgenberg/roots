import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { RootsGrassAccent, RootsGrassDivider } from "@/components/brand";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function ForForeningar() {
  const locale = await getRequestLocale();
  const { forClubs } = getHome(locale);

  return (
    <section className="relative overflow-hidden bg-brand-100 py-20 pb-24 md:py-28 md:pb-32">
      <RootsGrassAccent className="right-[4%] top-[4%]" />
      <RootsGrassDivider
        variant="dark"
        className="absolute inset-x-0 bottom-0 h-10 opacity-50 md:h-14"
      />

      <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{forClubs.badge}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">{forClubs.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{forClubs.body}</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {forClubs.benefits.map((benefit) => (
            <Card
              key={benefit.title}
              className="border-0 bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
            >
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src="/images/club-youth-selling.png"
              alt={forClubs.sellingAlt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
          </div>
          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src="/images/club-camp-cup.png"
              alt={forClubs.campAlt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
          </div>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-4">
          <Button size="lg" pulse asChild>
            <LocaleLink href="/registrera" localeNeutral>
              {forClubs.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <LocaleLink href="/sa-fungerar-det#rakna">
              {forClubs.ctaCalc}
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
