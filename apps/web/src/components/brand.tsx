/**
 * Sprint E14 — brand asset components.
 *
 * Wraps the marketing-agency-delivered logotype, symbol and graphic
 * element (under `apps/web/public/brand/`) as small reusable React
 * components so the whole codebase has a single import for each.
 *
 * Why a wrapper:
 *  - Variants ("black" / "white" / "dark") are baked into the filename
 *    convention from the brand kit. Picking the right one based on
 *    background is the single most common mistake — centralising that
 *    logic here means no individual page needs to remember it.
 *  - `next/image` handles webp/avif derivation + lazy loading, so the
 *    4000×4000 PNG sources never ship to the browser as PNG.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoVariant = "black" | "white" | "dark";

const LOGO_SRC: Record<LogoVariant, string> = {
  black: "/brand/roots-logo-black.png",
  white: "/brand/roots-logo-white.png",
  dark: "/brand/roots-logo-dark.png",
};

const SYMBOL_SRC: Record<LogoVariant, string> = {
  black: "/brand/roots-symbol-black.png",
  white: "/brand/roots-symbol-white.png",
  dark: "/brand/roots-symbol-dark.png",
};

const ELEMENT_SRC = {
  dark: "/brand/roots-element-dark.png",
  light: "/brand/roots-element-light.png",
  neutral: "/brand/roots-element-neutral.png",
} as const;

interface BrandImageProps {
  className?: string;
  // Apply a min-tap-target wrapper for header/footer logo clicks.
  priority?: boolean;
}

/**
 * The full Roots logotype (the handwritten organic "roots" wordmark).
 * Aspect ratio is ~16:9 in the source file. We render it as a fixed-
 * height block so the caller controls the size via Tailwind classes
 * on the wrapper (e.g. `className="h-8 md:h-10"`).
 */
export function RootsLogo({
  variant = "black",
  className,
  priority = false,
}: BrandImageProps & { variant?: LogoVariant | "auto" }) {
  // "auto" är till för chrome som ligger på en tema-styrd yta — header,
  // sidebar, footer. Den svarta wordmarken försvinner nästan helt mot den
  // mörka bakgrunden, så vi lägger båda i DOM:en och låter CSS välja. Att
  // läsa temat i JS skulle blinka fel logo en bildruta vid varje sidladdning.
  if (variant === "auto") {
    return (
      <span className={cn("relative inline-block h-8 w-[80px]", className)}>
        <Image
          src={LOGO_SRC.black}
          alt="Roots"
          fill
          className="object-contain dark:hidden"
          priority={priority}
          sizes="(max-width: 768px) 80px, 120px"
        />
        <Image
          src={LOGO_SRC.white}
          alt=""
          aria-hidden="true"
          fill
          className="hidden object-contain dark:block"
          priority={priority}
          sizes="(max-width: 768px) 80px, 120px"
        />
      </span>
    );
  }

  return (
    <span className={cn("relative inline-block h-8 w-[80px]", className)}>
      <Image
        src={LOGO_SRC[variant]}
        alt="Roots"
        fill
        className="object-contain"
        priority={priority}
        sizes="(max-width: 768px) 80px, 120px"
      />
    </span>
  );
}

/**
 * The Roots brand symbol (sand circle with the leaf/growth motif).
 * Square. Use for favicons, avatars, badges, OG-overlays, 404 pages.
 */
export function RootsSymbol({
  variant = "dark",
  className,
  priority = false,
}: BrandImageProps & { variant?: LogoVariant }) {
  return (
    <span className={cn("relative inline-block h-8 w-8", className)}>
      <Image
        src={SYMBOL_SRC[variant]}
        alt="Roots symbol"
        fill
        className="object-contain"
        priority={priority}
        sizes="(max-width: 768px) 64px, 96px"
      />
    </span>
  );
}

/**
 * The grass/roots graphic element from the brandbook — eight stylised
 * blades growing up from a baseline. Used as a subtle bottom band on
 * hero sections, between major sections, and above the footer.
 *
 * The PNG ships in dark / light / neutral colourways. The light variant
 * pairs naturally with the warm sand-50 background, dark with cream/
 * sand-100, neutral for image overlays.
 */
export function RootsGrassDivider({
  variant = "neutral",
  className,
  ariaHidden = true,
}: {
  variant?: keyof typeof ELEMENT_SRC;
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <div
      // The element is decorative — never announced to screen readers.
      aria-hidden={ariaHidden}
      className={cn(
        "pointer-events-none relative w-full select-none",
        // Default aspect ratio from the source PNG (≈3.4:1). We render
        // it as a band that gracefully scales. Override via className.
        "h-12 md:h-16 lg:h-20",
        className
      )}
    >
      <Image
        src={ELEMENT_SRC[variant]}
        alt=""
        fill
        className="object-contain object-bottom"
        sizes="100vw"
      />
    </div>
  );
}

/** Locale-aware branded loader (client). Re-exported for a stable import path. */
export { RootsLoader } from "./roots-loader";
