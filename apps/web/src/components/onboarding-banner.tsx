"use client";

/**
 * MASTERPLAN_01 KC3.1 — onboarding-progress-banner.
 *
 * Visas högst upp på /forening dashboard så länge ASSOCIATION_ADMIN
 * inte har klarat alla checklist-steg. Klick = navigera till
 * /forening/kom-igang.
 *
 * Designval:
 *   - Self-contained: hämtar sin egen status via apiFetch så att den
 *     kan renderas på vilken sida som helst utan props-drilling.
 *   - Auto-hide när `completed: true` så vi inte vänjer användaren vid
 *     att stänga av banners (annars börjar de stänga av riktiga warnings).
 *   - Localstorage-baserad "ignored"-state finns INTE medvetet — vi vill
 *     att den dyker upp tills det är gjort. Användare som tycker den är
 *     i vägen är just de som mest behöver checklistan.
 *   - Fail-soft: rendera ingen banner om endpointen failar (403 för fel
 *     roll, 500, etc) istället för en intrusive error-state.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MinimalStatus {
  completed: boolean;
  completedCount: number;
  totalSteps: number;
}

export function OnboardingBanner({ className }: { className?: string }) {
  const [status, setStatus] = useState<MinimalStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MinimalStatus>("/v1/association/onboarding-status").then(
      ({ ok, data }) => {
        if (cancelled) return;
        if (ok && data) setStatus(data);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || status.completed) return null;

  const progress = Math.round(
    (status.completedCount / status.totalSteps) * 100
  );

  return (
    <Link
      href="/forening/kom-igang"
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/50 p-4 transition-shadow hover:shadow-md sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0 rounded-lg bg-brand-700 p-2 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-900 sm:text-base">
            Slutför uppstarten — {status.completedCount} av {status.totalSteps} klara
          </p>
          <p className="mt-0.5 text-xs text-brand-800/80 sm:text-sm">
            Vi har en checklista som tar er hela vägen till första försäljningen.
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-200/60">
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-700"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
