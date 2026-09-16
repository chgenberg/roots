"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";

export function AnnouncementBar({ className }: { className?: string }) {
  const { t } = useLocale();

  return (
    <div
      className={cn(
        "bg-brand-100/80 backdrop-blur-xl dark:bg-background/80",
        className
      )}
      role="region"
      aria-label={t.aria.announcement}
    >
      <p className="flex h-9 items-center justify-center px-4 text-center text-[11px] uppercase tracking-[0.14em] text-brand-900/70 dark:text-foreground/70">
        {t.announcement}
      </p>
    </div>
  );
}
