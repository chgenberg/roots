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
      <div className="relative h-[calc(100dvh-5rem)] min-h-[500px] overflow-hidden rounded-xl">
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

        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent" />

        <div className="relative flex h-full flex-col justify-start p-6 pt-10 md:p-10 md:pt-14">
          <div className="max-w-md">
            <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.1] tracking-tight text-white">
              {hero.titleLine1}
              <br />
              {hero.titleLine2}
            </h1>
            <p
              className="mt-3 max-w-xs text-sm leading-relaxed text-white/90 md:text-base"
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
          className="absolute inset-x-0 bottom-0 h-10 opacity-50 md:h-14 lg:h-16"
          aria-hidden
        />
      </div>
    </section>
  );
}
