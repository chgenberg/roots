import Image from "next/image";
import { HeroLead } from "@/components/sections/hero-lead";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function HeroSection() {
  const locale = await getRequestLocale();
  const { hero } = getHome(locale);

  return (
    <section className="relative overflow-hidden md:h-[min(36rem,calc(100dvh-7rem))] md:min-h-[26rem]">
      <div className="relative aspect-[4/3] md:absolute md:inset-0 md:aspect-auto">
      <Image
        src="/images/home-hero-2.jpg"
        alt={hero.altDesktop}
        fill
        className="object-cover object-[80%_center] lg:object-center"
        priority
        sizes="100vw"
      />
      </div>

      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/40 via-black/15 to-transparent md:block" />

      <div className="relative mx-auto flex max-w-[1400px] items-center px-6 py-10 md:h-full md:px-10 md:py-0 xl:px-8">
        <div className="max-w-lg">
          <h1
            className="text-[clamp(1.75rem,1.2rem+1.8vw,2.75rem)] font-normal leading-[1.15] md:max-w-[20rem] lg:max-w-none tracking-tight text-foreground md:text-white md:[text-shadow:0_1px_18px_rgba(0,0,0,0.25)]"
          >
            {hero.titleLine1}
          </h1>
          <p
            className="mt-4 max-w-md text-sm md:max-w-[20rem] lg:max-w-md leading-relaxed text-muted-foreground md:text-base md:text-white/90 md:[text-shadow:0_1px_4px_rgba(0,0,0,0.3)]"
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
