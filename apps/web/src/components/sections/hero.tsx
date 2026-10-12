import Image from "next/image";
import { HeroLead } from "@/components/sections/hero-lead";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function HeroSection() {
  const locale = await getRequestLocale();
  const { hero } = getHome(locale);

  return (
    <section className="relative overflow-hidden xl:h-[min(36rem,calc(100dvh-7rem))] xl:min-h-[26rem]">
      <div className="relative aspect-[4/3] sm:aspect-[16/9] xl:absolute xl:inset-0 xl:aspect-auto">
      <Image
        src="/images/roots-home-hero-mix.jpg"
        alt={hero.altDesktop}
        fill
        className="object-cover object-center"
        priority
        sizes="100vw"
      />
      </div>

      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/40 via-black/15 to-transparent xl:block" />

      <div className="relative mx-auto flex max-w-[1400px] items-center px-6 py-10 md:px-10 xl:h-full xl:px-8 xl:py-0">
        <div className="max-w-lg">
          <h1
            className="text-[clamp(1.75rem,1.2rem+1.8vw,2.75rem)] font-normal leading-[1.15] tracking-tight text-foreground xl:text-white xl:[text-shadow:0_1px_18px_rgba(0,0,0,0.25)]"
          >
            {hero.titleLine1}
          </h1>
          <p
            className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground xl:text-base xl:text-white/90 xl:[text-shadow:0_1px_4px_rgba(0,0,0,0.3)]"
          >
            {hero.titleLine2}
          </p>
          <HeroLead
            ctaHairAnalysis={hero.ctaHairAnalysis}
            ctaProducts={hero.ctaProducts}
            ctaClub={hero.ctaClub}
          />
        </div>
      </div>
    </section>
  );
}
