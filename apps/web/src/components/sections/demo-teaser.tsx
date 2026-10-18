"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { demo } from "@/i18n/dictionaries/demo";
import { useLocale } from "@/i18n/locale-context";
import { withLocale } from "@/i18n/paths";

/** Startsidans ingång till /prova: skriv föreningens namn, se er shop. */
export function DemoTeaser() {
  const { locale } = useLocale();
  const t = demo[locale];
  const router = useRouter();
  const [club, setClub] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = club.trim();
    const qs = name.length >= 2 ? `?forening=${encodeURIComponent(name)}` : "";
    router.push(withLocale(`/prova${qs}`, locale));
  }

  return (
    <section className="pb-6 md:pb-8">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto grid max-w-5xl items-center gap-8 rounded-[32px] bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] px-6 py-10 text-[#5E5341] sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:px-14 md:py-14">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#3F372B]">{t.teaserTitle}</h2>
            <p className="mt-3 max-w-md text-lg text-[#6D614D]">{t.teaserBody}</p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="demo-teaser-club" className="sr-only">
              {t.clubLabel}
            </label>
            <input
              id="demo-teaser-club"
              value={club}
              onChange={(e) => setClub(e.target.value.slice(0, 60))}
              placeholder={t.clubPlaceholder}
              autoComplete="organization"
              className="min-w-0 flex-1 rounded-full border border-[#D5CABF] bg-white/85 px-5 py-3.5 text-base text-[#3F372B] placeholder:text-[#8B7E69] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D614D]/40"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#3F372B] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#2B2620]"
            >
              {t.teaserButton}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
