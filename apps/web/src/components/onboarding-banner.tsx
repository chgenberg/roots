"use client";

/**
 * MASTERPLAN_01 KC3.1 — onboarding-progress-banner.
 *
 * Visas högst upp på /forening så länge ASSOCIATION_ADMIN inte klarat
 * alla checklist-steg. Visar nästa ofärdiga steg med egen knapp; hela
 * listan finns på /forening/kom-igang.
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  ctaHref: string;
  ctaLabel: string;
}

export interface OnboardingStatus {
  orgName?: string;
  completed: boolean;
  completedCount: number;
  totalSteps: number;
  steps?: OnboardingStep[];
}

export function OnboardingBanner({
  status,
  className,
}: {
  status: OnboardingStatus | null;
  className?: string;
}) {
  const { locale } = useLocale();
  const t = fundraisingPages.onboardingBanner[locale];

  if (!status || status.completed) return null;

  const progress = Math.round((status.completedCount / status.totalSteps) * 100);
  const next = status.steps?.find((s) => !s.completed) ?? null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/50 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0 rounded-lg bg-brand-700 p-2 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-800/80">
            {tFill(t.title, { done: status.completedCount, total: status.totalSteps })}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-200/60">
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-700"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
          {next ? (
            <>
              <p className="mt-3 text-sm font-semibold text-brand-900 sm:text-base">
                {tFill(t.nextStep, { label: next.label })}
              </p>
              <p className="mt-0.5 text-xs text-brand-800/80 sm:text-sm">{next.description}</p>
            </>
          ) : (
            <p className="mt-3 text-xs text-brand-800/80 sm:text-sm">{t.body}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {next && (
              <LocaleLink
                href={next.ctaHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
              >
                {next.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </LocaleLink>
            )}
            <LocaleLink
              href="/forening/kom-igang"
              className="text-[13px] font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              {t.allSteps}
            </LocaleLink>
          </div>
        </div>
      </div>
    </section>
  );
}
