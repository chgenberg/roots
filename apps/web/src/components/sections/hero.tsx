import Image from "next/image";
import { HeroLead } from "@/components/sections/hero-lead";
import { RootsGrassDivider } from "@/components/brand";

export function HeroSection() {
  return (
    <section className="px-3 pb-2 pt-2 md:px-5 md:pb-3 md:pt-3">
      <div className="relative h-[calc(100dvh-5rem)] min-h-[500px] overflow-hidden rounded-xl">
        {/* Desktop */}
        <div className="absolute inset-0 hidden lg:block">
          <Image
            src="/images/collection-2.jpg"
            alt="Roots — Roots Schampoo, Roots Conditioner och Roots Body Wash"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>

        {/* Mobile */}
        <div className="absolute inset-0 lg:hidden">
          <Image
            src="/images/hero-mobile.jpg"
            alt="Roots — Roots Schampoo, Roots Conditioner och Roots Body Wash"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent" />

        {/* Text content — top left */}
        <div className="relative flex h-full flex-col justify-start p-6 pt-10 md:p-10 md:pt-14">
          <div className="max-w-md">
            <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.1] tracking-tight text-white">
              Naturlig hårvård.
              <br />
              Ren känsla.
            </h1>
            {/* MASTERPLAN_01 KC6.10: text-white/70 mot photo-bg failar
                WCAG AA contrast (~3.5:1). Höj opacity + lägg på subtle
                text-shadow för att kompensera ojämn bakgrundsluminans
                (mörka hörn vs ljusa central-pixels). */}
            <p
              className="mt-3 max-w-xs text-sm leading-relaxed text-white/90 md:text-base"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
            >
              Tre produkter för föreningslivet — utan sulfater, silikoner eller parabener.
            </p>
            <HeroLead />
          </div>
        </div>

        {/* Soft inner ring */}
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />

        {/* Sprint E14: brand grass element along the bottom edge of the
            hero — gives the photograph a tactile "growing from the
            ground" feel without crowding the headline. The neutral
            variant blends with the photo tones; opacity keeps it subtle. */}
        <RootsGrassDivider
          variant="neutral"
          className="absolute inset-x-0 bottom-0 h-10 opacity-50 md:h-14 lg:h-16"
          aria-hidden
        />
      </div>
    </section>
  );
}
