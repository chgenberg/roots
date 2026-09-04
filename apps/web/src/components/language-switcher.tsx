"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { switchLocalePath } from "@/i18n/paths";
import { useLocale } from "@/i18n/locale-context";

/**
 * Discrete language toggle — shows the target locale as type, not a flag.
 * A Union Jack on the Swedish site read as "the page is in English".
 *
 * Uses a full document navigation (plain `<a>`, not Next `<Link>`). Soft
 * navigation cannot reliably refresh RSC page trees when middleware rewrites
 * `/en/...` → `/...` — chrome would update while hero/body stayed on the
 * previous language.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const routerPathname = usePathname() || "/";
  const { locale } = useLocale();
  // Middleware rewrites strip `/en` from usePathname; prefer the browser URL.
  const asPath =
    typeof window !== "undefined" ? window.location.pathname : routerPathname;
  const target = switchLocalePath(asPath);
  const toEn = locale === "sv";

  return (
    <a
      href={target}
      hrefLang={toEn ? "en" : "sv"}
      className={cn(
        "group flex h-10 min-w-10 items-center justify-center rounded-full px-2 transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={toEn ? "Switch to English" : "Byt till svenska"}
      title={toEn ? "English" : "Svenska"}
    >
      <span className="font-display text-[11px] font-medium tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
        {toEn ? "EN" : "SV"}
      </span>
    </a>
  );
}
