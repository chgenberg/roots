"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { switchLocalePath } from "@/i18n/paths";
import { useLocale } from "@/i18n/locale-context";

/** Minimalist flag marks — not photo-real flags, just a calm locale cue. */
function FlagSv({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 12"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="16" height="12" rx="1" fill="#006AA7" />
      <rect x="5" width="2.2" height="12" fill="#FECC02" />
      <rect y="5" width="16" height="2.2" fill="#FECC02" />
    </svg>
  );
}

function FlagEn({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 12"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="16" height="12" rx="1" fill="#012169" />
      <path d="M0 0 L16 12 M16 0 L0 12" stroke="#fff" strokeWidth="2" />
      <path d="M0 0 L16 12 M16 0 L0 12" stroke="#C8102E" strokeWidth="1" />
      <rect x="6.5" width="3" height="12" fill="#fff" />
      <rect y="4.5" width="16" height="3" fill="#fff" />
      <rect x="7" width="2" height="12" fill="#C8102E" />
      <rect y="5" width="16" height="2" fill="#C8102E" />
    </svg>
  );
}

/**
 * Discrete language toggle — sits to the right of the contact/demo icon.
 * Shows the *target* locale flag (EN when on Swedish, SV when on English).
 * Uses the shared locale context so it stays in sync with nav/footer copy.
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
    <Link
      href={target}
      hrefLang={toEn ? "en" : "sv"}
      className={cn(
        "group flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={toEn ? "Switch to English" : "Byt till svenska"}
      title={toEn ? "English" : "Svenska"}
    >
      {toEn ? (
        <FlagEn className="h-3.5 w-[18px] opacity-80 transition-opacity group-hover:opacity-100" />
      ) : (
        <FlagSv className="h-3.5 w-[18px] opacity-80 transition-opacity group-hover:opacity-100" />
      )}
    </Link>
  );
}
