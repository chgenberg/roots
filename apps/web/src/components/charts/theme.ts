// Brand-aligned chart palette. All values map 1:1 to the Roots brandbook
// tokens (E13) so charts never drift from the design system. No neon, no
// gradients outside the subtle area-fills below.

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

/** Öre → "12 300 kr" (svensk gruppering, inga decimaler). */
export function formatKr(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

/** Öre → kompakt "12,3k" för axel-/stapel-etiketter. */
export function formatKrShort(ore: number): string {
  const kr = ore / 100;
  if (kr >= 1000) return `${(kr / 1000).toFixed(kr >= 10000 ? 0 : 1)}k`;
  return `${Math.round(kr)}`;
}

/** "YYYY-MM-DD" → "5 jun". */
export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  swish: "Swish",
  card: "Kort",
  klarna: "Klarna",
  pay_later: "Klarna",
  pay_now: "Klarna",
  invoice: "Klarna",
  direct_to_leader: "Via laget",
  cash: "Kontant",
  kontant: "Kontant",
};

export function paymentLabel(method: string): string {
  const m = method.toLowerCase();
  if (PAYMENT_LABELS[m]) return PAYMENT_LABELS[m];
  if (m.includes("swish")) return "Swish";
  if (m.includes("card") || m.includes("kort")) return "Kort";
  if (m.includes("klarna") || m.includes("invoice") || m.includes("pay"))
    return "Klarna";
  if (m.includes("cash") || m.includes("kontant")) return "Kontant";
  if (m === "okänd" || !m) return "Okänd";
  return method.charAt(0).toUpperCase() + method.slice(1);
}
