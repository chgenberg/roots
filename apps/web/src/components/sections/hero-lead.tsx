"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HairAnalysisLeadDialog } from "@/components/hair-analysis-lead-dialog";

export function HeroLead() {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <HairAnalysisLeadDialog
        trigger={
          <button
            type="button"
            className="group relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-neutral-900 shadow-sm transition-transform duration-300 hover:scale-[1.03] hover:bg-neutral-100 active:scale-[0.98]"
          >
            <span className="absolute inset-0 rounded-full shadow-[0_0_0_0_rgba(255,255,255,0.3)] animate-[pulse-shadow-light_2.5s_ease-in-out_infinite]" />
            <span className="relative">Starta din håranalys</span>
            <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        }
      />

      <Link
        href="/produkter"
        className="inline-flex h-11 items-center px-4 text-sm font-medium text-white/70 transition-colors duration-200 hover:text-white"
      >
        Se produkterna
      </Link>
    </div>
  );
}
