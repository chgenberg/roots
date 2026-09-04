"use client";

import { ArrowRight } from "lucide-react";
import { HairAnalysisLeadDialog } from "@/components/hair-analysis-lead-dialog";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { LocaleLink } from "@/components/locale-link";

const PRIMARY_CLASS =
  "group relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-neutral-900 shadow-sm transition-transform duration-300 motion-safe:hover:scale-[1.03] hover:bg-neutral-100 motion-safe:active:scale-[0.98]";

const SECONDARY_CLASS =
  "inline-flex h-11 items-center rounded-full border border-white/70 bg-black/30 px-5 text-sm font-medium text-white backdrop-blur-[2px] transition-colors duration-200 hover:bg-black/40";

export function HeroLead({
  ctaHairAnalysis,
  ctaProducts,
  ctaClub,
}: {
  ctaHairAnalysis: string;
  ctaProducts: string;
  ctaClub: string;
}) {
  const productsLink = (
    <LocaleLink href="/produkter" className={SECONDARY_CLASS}>
      {ctaProducts}
    </LocaleLink>
  );

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      {HAIR_ANALYSIS_ENABLED ? (
        <>
          <HairAnalysisLeadDialog
            trigger={
              <button type="button" className={PRIMARY_CLASS}>
                <span className="absolute inset-0 rounded-full shadow-[0_0_0_0_rgba(255,255,255,0.3)] motion-safe:animate-[pulse-shadow-light_2.5s_ease-in-out_infinite]" />
                <span className="relative">{ctaHairAnalysis}</span>
                <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5" />
              </button>
            }
          />
          {productsLink}
        </>
      ) : (
        <>
          <LocaleLink href="/sa-fungerar-det#rakna" className={PRIMARY_CLASS}>
            <span className="absolute inset-0 rounded-full shadow-[0_0_0_0_rgba(255,255,255,0.3)] motion-safe:animate-[pulse-shadow-light_2.5s_ease-in-out_infinite]" />
            <span className="relative">{ctaClub}</span>
            <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5" />
          </LocaleLink>
          {productsLink}
        </>
      )}
    </div>
  );
}
