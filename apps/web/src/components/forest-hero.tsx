import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Samma skogsruta som kalkylatorns resultatsiffra. En siffra, en mening,
 * ev. nästa handling — inte ett KPI-kort bland andra.
 */
export function ForestHero({
  label,
  value,
  hint,
  children,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-brand-700 text-white shadow-sm",
        className
      )}
    >
      <div className="p-6 sm:p-8">
        <p className="text-sm font-medium text-brand-100">{label}</p>
        <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
          {value}
        </p>
        {hint ? (
          <p className="mt-3 text-sm text-brand-100/90">{hint}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </div>
  );
}

export function forestHeroActionClassName(
  extra?: string
): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25",
    extra
  );
}
