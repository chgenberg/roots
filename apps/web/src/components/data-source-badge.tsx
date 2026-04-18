"use client";

import { webFlags } from "@/lib/flags";
import { cn } from "@/lib/utils";

interface DataSourceBadgeProps {
  /** When true the dataset is local fallback/illustrative. */
  demo: boolean;
  className?: string;
}

/**
 * Small inline label used on dashboard cards and lists so authenticated users
 * can tell whether a number is live or a placeholder. Hidden entirely when the
 * `FEATURE_DATA_SOURCE_BADGE` flag is off, so it is safe to scatter in the UI.
 */
export function DataSourceBadge({ demo, className }: DataSourceBadgeProps) {
  if (!webFlags.dataSourceBadge()) return null;
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        demo
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200",
        className
      )}
      aria-label={demo ? "Demo-data" : "Live data"}
      title={demo ? "Demo-data — inga riktiga siffror än" : "Live data"}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          demo ? "bg-amber-500" : "bg-emerald-500"
        )}
      />
      {demo ? "Demo-data" : "Live"}
    </span>
  );
}
