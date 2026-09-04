/**
 * Sprint E13 — brandbook fonts.
 *
 * The marketing agency delivered Alan Sans (display / headlines) and
 * Inter (body). We load both as local fonts so:
 *
 *   1. No browser request to fonts.google.com → GDPR-safe and snappier.
 *   2. The files are versioned with the codebase — design will never
 *      drift because Google ships a new weight.
 *   3. We get next/font's automatic FOIT-prevention and zero-runtime
 *      CSS @font-face injection.
 *
 * Source files live under apps/web/public/fonts/, copied from the
 * brandbook delivery in public/Roots_lev/Fonts/.
 */

import localFont from "next/font/local";

export const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  // Inter ships separate Bold/Italic files (not a variable font for
  // body weights here), so we declare each face explicitly.
  src: [
    {
      path: "../../public/fonts/inter/Inter_18pt-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter_18pt-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter_18pt-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/inter/Inter_18pt-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter_18pt-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
});

export const alanSans = localFont({
  variable: "--font-alan-sans",
  display: "swap",
  // Display face — used for h1-h6 and brand accents only. Loaded in
  // the weights the brandbook examples actually demonstrate.
  src: [
    {
      path: "../../public/fonts/alan-sans/AlanSans-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../../public/fonts/alan-sans/AlanSans-Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
});
