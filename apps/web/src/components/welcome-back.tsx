"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { clubGenitive, demo } from "@/i18n/dictionaries/demo";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";
import { dismissReturningMemory, readReturningMemory } from "@/lib/visitor-memory";
import { cn } from "@/lib/utils";

type Line = { text: string; cta: string; href: string };

/**
 * "Välkommen tillbaka." Läser det besökaren räknade på eller provade vid ett
 * tidigare besök — bara ur den egna webbläsaren.
 */
export function WelcomeBack() {
  const { locale } = useLocale();
  const t = demo[locale];
  const [line, setLine] = useState<Line | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const { calc, demo: shop } = readReturningMemory();
    const kr = (n: number) => {
      const s = Math.round(n).toLocaleString(locale === "en" ? "en-GB" : "sv-SE");
      return locale === "en" ? `SEK ${s}` : `${s} kr`;
    };
    let next: Line | null = null;
    if (calc && (!shop || calc.at >= shop.at)) {
      const qs = calc.clubName ? `?forening=${encodeURIComponent(calc.clubName)}` : "";
      next = {
        text: calc.clubName
          ? tFill(t.welcomeCalcClub, { clubGen: clubGenitive(calc.clubName, locale), amount: kr(calc.earningsKr) })
          : tFill(t.welcomeCalc, { amount: kr(calc.earningsKr) }),
        cta: t.welcomeCalcCta,
        href: `/intresseanmalan${qs}`,
      };
    } else if (shop) {
      const p = new URLSearchParams({ forening: shop.club });
      if (shop.team) p.set("lag", shop.team);
      if (shop.goalKr) p.set("mal", String(shop.goalKr));
      if (shop.website) p.set("webb", shop.website);
      if (shop.website && shop.colour) p.set("farg", shop.colour.slice(1));
      next = {
        text: tFill(t.welcomeDemo, { clubGen: clubGenitive(shop.club, locale) }),
        cta: t.welcomeDemoCta,
        href: `/prova?${p.toString()}`,
      };
    }
    if (!next) return;
    setLine(next);
    const id = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(id);
  }, [locale, t]);

  if (!line) return null;

  function close() {
    dismissReturningMemory();
    setVisible(false);
    window.setTimeout(() => setLine(null), 300);
  }

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.75rem)] left-4 right-4 z-30 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md",
        "transition-all duration-500 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 py-3 pl-4 pr-2 text-sm text-[#3F372B] shadow-[0_18px_40px_-16px_rgba(63,55,43,0.45)] ring-1 ring-[#E6DED2] backdrop-blur">
        <p className="min-w-0 flex-1 leading-snug">{line.text}</p>
        <LocaleLink
          href={line.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#6D614D] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#5E5341]"
        >
          {line.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </LocaleLink>
        <button
          type="button"
          onClick={close}
          aria-label={t.welcomeDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#7F715B] transition-colors hover:bg-[#F3EEE6]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
