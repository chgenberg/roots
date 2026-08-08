"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import { appCommon } from "@/i18n/dictionaries/app-common";

const SYMBOL_SRC = "/brand/roots-symbol-dark.png";

/**
 * Branded loading indicator — the Roots symbol with a gentle pulse.
 * Uses the active locale when no explicit label is provided
 * (`useLocale` falls back to Swedish outside LocaleProvider).
 */
export function RootsLoader({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { locale } = useLocale();
  const resolvedLabel = label ?? appCommon[locale].loading;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[50vh] flex-col items-center justify-center gap-3",
        className
      )}
    >
      <span className="relative inline-block h-12 w-12 animate-subtle-pulse">
        <Image
          src={SYMBOL_SRC}
          alt=""
          fill
          className="object-contain"
          sizes="48px"
          priority
        />
      </span>
      <span className="sr-only">{resolvedLabel}</span>
    </div>
  );
}
