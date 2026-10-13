import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function ForForeningar() {
  const locale = await getRequestLocale();
  const { forClubs } = getHome(locale);

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{forClubs.badge}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">{forClubs.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{forClubs.body}</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-10 text-center md:grid-cols-3 md:gap-12">
          {forClubs.benefits.map((benefit) => (
            <div key={benefit.title}>
              <h3 className="text-lg font-semibold">{benefit.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src="/images/roots-club-selling-w.jpg"
              alt={forClubs.sellingAlt}
              fill
              className="object-cover object-[center_35%] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src="/images/roots-team.jpg"
              alt={forClubs.campAlt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button className="bg-[#6D614D] text-white hover:bg-[#5c5241]" asChild>
            <LocaleLink href="/intresseanmalan">
              {forClubs.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
          <Button className="bg-[#6D614D] text-white hover:bg-[#5c5241]" asChild>
            <LocaleLink href="/sa-fungerar-det#rakna">
              {forClubs.ctaCalc}
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
