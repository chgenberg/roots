import Image from "next/image";
import { HeroLead } from "@/components/sections/hero-lead";
import { RootsGrassDivider } from "@/components/brand";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function HeroSection() {
  const locale = await getRequestLocale();
  const { hero } = getHome(locale);

  return (
    <section className="px-3 pb-2 pt-2 md:px-5 md:pb-3 md:pt-3">
      <div className="relative h-[min(32rem,calc(100dvh-11rem))] min-h-[24rem] overflow-hidden rounded-xl md:min-h-[26rem]">
        <div className="absolute inset-0 hidden lg:block">
          <Image
            src="/images/sport-hero.jpg"
            alt={hero.altDesktop}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>

        <div className="absolute inset-0 lg:hidden">
          <Image
            src="/images/sport-hero-mobile.jpg"
            alt={hero.altMobile}
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/28 to-transparent" />

        <div className="relative flex h-full items-start p-6 pt-8 md:p-10 md:pt-12 lg:px-14 lg:pt-14">
          <div className="max-w-lg">
            <h1
              className="text-[clamp(1.45rem,1.15rem+1vw,2rem)] leading-[1.22] tracking-tight text-white"
              style={{ textShadow: "0 1px 16px rgba(0,0,0,0.28)" }}
            >
              <span className="block">{hero.titleLine1}</span>
              <span className="mt-2 block max-w-md text-[clamp(1rem,0.92rem+0.3vw,1.15rem)] font-normal leading-snug text-white/90">
                {hero.titleLine2}
              </span>
            </h1>
            <p
              className="mt-3 max-w-md text-sm leading-relaxed text-white/85 md:text-[0.95rem]"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
            >
              {hero.body}
            </p>
            <HeroLead
              ctaHairAnalysis={hero.ctaHairAnalysis}
              ctaProducts={hero.ctaProducts}
              ctaClub={hero.ctaClub}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />

        <RootsGrassDivider
          variant="neutral"
          className="absolute inset-x-0 bottom-0 opacity-50"
          aria-hidden
        />
      </div>
    </section>
  );
}
