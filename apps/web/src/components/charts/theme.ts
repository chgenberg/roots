// Brand-aligned chart palette. All values map 1:1 to the Roots brandbook
// tokens (E13) so charts never drift from the design system. No neon, no
// gradients outside the subtle area-fills below.

import type { Locale } from "@/i18n/config";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

export const CHART = {
  // Primärt dataspår — brandbook FOREST (brand-700).
  primary: "#6B794F",
  // Bläck/ink — brandbook (brand-900). Används som mörk kontrast-stapel.
  ink: "#1D1D1B",
  // Spår/bakgrund för staplar (brand-100).
  track: "#F1EBE2",
  // Rutnät + axlar (brand-200 / border).
  grid: "#E5DDD2",
  // Sekundär text (sand-dark / muted-foreground).
  muted: "#7F715B",
} as const;

// Distinkt men dämpad serie-palett (brandbook sekundärfärger) för
// donut/kategorier. Ordningen är vald för bra kontrast bredvid varandra.
export const SERIES = [
  "#6B794F", // forest
  "#A7BBC5", // sky
  "#E18754", // terracotta
  "#ECD488", // sun
  "#C1BF99", // olive
  "#B2A491", // sand-medium
  "#1D1D1B", // ink
] as const;

export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}

// formatKr/formatKrShort bor i @/lib/format och åter-exportas här så att
// diagram-importerna inte behöver skrivas om.
export { formatKr, formatKrShort } from "@/lib/format";

/** "YYYY-MM-DD" → "5 jun" / "5 Jun". */
export function formatDayLabel(iso: string, locale: Locale = "sv"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function paymentLabel(method: string, locale: Locale = "sv"): string {
  const t = fundraisingPages.paymentMethod[locale];
  const m = method.toLowerCase();
  if (m === "swish" || m.includes("swish")) return t.swish;
  if (m === "card" || m.includes("card") || m.includes("kort")) return t.card;
  if (
    m.includes("klarna") ||
    m.includes("invoice") ||
    m.includes("pay_later") ||
    m.includes("pay_now") ||
    m.includes("pay")
  )
    return t.klarna;
  if (m === "direct_to_leader" || m.includes("direct")) return t.viaTeam;
  if (m === "cash" || m.includes("kontant") || m.includes("cash")) return t.cash;
  if (m === "okänd" || m === "unknown" || !m) return t.unknown;
  return method.charAt(0).toUpperCase() + method.slice(1);
}
