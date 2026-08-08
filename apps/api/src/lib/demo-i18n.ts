import type { UiLocale } from "./ui-locale";

/**
 * Demo seed content in packages/db is Swedish. When the UI locale is
 * English, overlay known demo campaign / org / team strings so shops
 * and portals on /en read fully in English without mutating the DB.
 */

type CampaignOverlay = {
  name: string;
  description: string;
  story: string;
};

const CAMPAIGN_BY_SLUG: Record<string, CampaignOverlay> = {
  "demo-varkampanj-2026": {
    name: "Spring Campaign 2026 (Demo)",
    description: "Fundraising for new jerseys and away matches.",
    story:
      "Demo Football Club is raising money for the annual pre-season " +
      "tournament in Malmö. Every pack gives the club a 30% contribution.",
  },
  "demo-hostkampanj-2026": {
    name: "Autumn Campaign 2026 (Demo)",
    description:
      "The club sells Roots packs to fund a youth cup in Helsingborg.",
    story:
      "Demo IF Sundsvall is raising money for a shared youth cup. " +
      "Every pack gives the club a 30% contribution — funds go to travel, " +
      "accommodation and match fees.",
  },
};

/** Exact Swedish seed strings → English (slug-less fallbacks). */
const STRING_OVERLAY: Record<string, string> = {
  "Demo Fotbollsklubb": "Demo Football Club",
  "Demo IF Sundsvall": "Demo IF Sundsvall",
  "Stockholm Allmänna Bandysällskap": "Stockholm Public Bandy Society",
  "Vårkampanj 2026 (Demo)": "Spring Campaign 2026 (Demo)",
  "Höstkampanj 2026 (Demo)": "Autumn Campaign 2026 (Demo)",
  "Herr A-lag (Demo)": "Men's First Team (Demo)",
  "P14 Blå (Demo)": "U14 Blue (Demo)",
  "Insamling till nya tröjor och bortamatcher.":
    "Fundraising for new jerseys and away matches.",
  "Föreningen säljer Roots-paket för att finansiera ungdoms-cup i Helsingborg.":
    "The club sells Roots packs to fund a youth cup in Helsingborg.",
  "Demo Fotbollsklubb samlar in pengar för att kunna åka på den årliga försäsongsturneringen i Malmö. Varje paket ger föreningen 30 % i bidrag.":
    "Demo Football Club is raising money for the annual pre-season tournament in Malmö. Every pack gives the club a 30% contribution.",
  "Demo IF Sundsvall samlar in pengar till en gemensam ungdoms-cup. Varje paket ger föreningen 30 % i bidrag — pengarna går till resa, boende och matchanmälningar.":
    "Demo IF Sundsvall is raising money for a shared youth cup. Every pack gives the club a 30% contribution — funds go to travel, accommodation and match fees.",
};

function overlayString(locale: UiLocale, value: string | null | undefined): string {
  if (!value) return value ?? "";
  if (locale !== "en") return value;
  return STRING_OVERLAY[value] ?? value;
}

export function localizeDemoOrgName(
  locale: UiLocale,
  name: string | null | undefined
): string {
  return overlayString(locale, name);
}

export function localizeDemoTeamName(
  locale: UiLocale,
  name: string | null | undefined
): string {
  return overlayString(locale, name);
}

export function localizeDemoCampaignFields(
  locale: UiLocale,
  campaign: {
    slug?: string | null;
    name?: string | null;
    description?: string | null;
    story?: string | null;
  }
): { name: string; description: string; story: string } {
  const bySlug =
    locale === "en" && campaign.slug
      ? CAMPAIGN_BY_SLUG[campaign.slug]
      : undefined;

  return {
    name:
      bySlug?.name ??
      overlayString(locale, campaign.name),
    description:
      bySlug?.description ??
      overlayString(locale, campaign.description),
    story:
      bySlug?.story ??
      overlayString(locale, campaign.story),
  };
}

export function localizeDemoCampaignName(
  locale: UiLocale,
  name: string | null | undefined,
  slug?: string | null
): string {
  if (locale === "en" && slug && CAMPAIGN_BY_SLUG[slug]) {
    return CAMPAIGN_BY_SLUG[slug].name;
  }
  return overlayString(locale, name);
}
