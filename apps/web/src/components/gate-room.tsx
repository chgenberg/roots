import type { ReactNode } from "react";
import Image from "next/image";
import { RootsLogo } from "@/components/brand";
import { LocaleLink } from "@/components/locale-link";
import { cn } from "@/lib/utils";

/** Samma primärknapp som waitlist — skog, inte svart mode-ecom. */
export const GATE_PRIMARY_BTN =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full " +
  "bg-brand-700 px-6 text-[15px] font-medium text-white " +
  "transition-all hover:bg-brand-800 active:scale-[0.99] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const GATE_CARD =
  "w-full rounded-3xl border-0 bg-card shadow-[var(--shadow-dialog)]";

/**
 * Foto + lätt overlay bakom waitlist och auth. Overflow ligger bara på
 * fotot så brödtext i kortet inte klipps i kanten.
 */
export function GateWordmark({
  href,
  ariaLabel,
}: {
  href?: string;
  ariaLabel?: string;
}) {
  const logo = (
    <RootsLogo
      variant="auto"
      className="h-10 w-[100px] sm:h-11 sm:w-[110px]"
      priority
    />
  );
  if (!href) return <div className="flex justify-center">{logo}</div>;
  return (
    <div className="flex justify-center">
      <LocaleLink
        href={href}
        aria-label={ariaLabel}
        className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
      >
        {logo}
      </LocaleLink>
    </div>
  );
}

export function GateRoom({
  children,
  className,
  frameClassName,
}: {
  children: ReactNode;
  className?: string;
  frameClassName?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <div
      className={cn(
        "relative flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:py-12",
        className
      )}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <Image
          src="/images/sport-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/40 via-brand-900/28 to-brand-900/55" />
      </div>

      <div className={cn("relative w-full max-w-[26rem]", frameClassName)}>
        {children}
        <p className="mt-5 text-center text-xs text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0/45%)]">
          © {year} Ourroots AB
        </p>
      </div>
    </div>
  );
}
