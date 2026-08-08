import type { Locale } from "./config";
import { fundraisingPages } from "./dictionaries/fundraising-pages";

const MILESTONE_IDS = [
  "first_sale",
  "5_packages",
  "10_packages",
  "5000_sek",
  "halfway",
  "25_packages",
  "10000_sek",
  "50_packages",
  "goal_reached",
] as const;

type MilestoneId = (typeof MILESTONE_IDS)[number];

/** Resolve a milestone label by id, or by matching the Swedish API label. */
export function milestoneLabel(
  idOrSwedishLabel: string,
  locale: Locale,
  fallback?: string
): string {
  const dict = fundraisingPages.milestones[locale];
  if ((MILESTONE_IDS as readonly string[]).includes(idOrSwedishLabel)) {
    return dict[idOrSwedishLabel as MilestoneId];
  }
  const sv = fundraisingPages.milestones.sv;
  for (const id of MILESTONE_IDS) {
    if (sv[id] === idOrSwedishLabel) return dict[id];
  }
  return fallback ?? idOrSwedishLabel;
}

/**
 * Best-effort localisation of API remaining strings like
 * "3 paket kvar" / "1 200 kr kvar". Also accepts already-localised
 * English ("3 packages left" / "SEK 1,200 left").
 */
export function milestoneRemaining(
  remaining: string | number,
  locale: Locale
): string {
  const text = String(remaining);
  if (locale === "sv") {
    // If API already returned English (stale client), leave as-is.
    return text;
  }

  const packages = text.match(/^(\d+)\s+paket kvar$/i);
  if (packages) {
    return fundraisingPages.milestones.en.packagesLeft.replace(
      "{n}",
      packages[1]
    );
  }

  const amount = text.match(/^(.+?)\s+kr kvar$/i);
  if (amount) {
    return fundraisingPages.milestones.en.amountLeft.replace(
      "{amount}",
      `SEK ${amount[1].trim()}`
    );
  }

  // Already English from the API — pass through.
  return text;
}
