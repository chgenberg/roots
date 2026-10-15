import type { UiLocale } from "./ui-locale";

/** Catalog display names for Stripe, emails and order status (not marketing copy). */
const BY_SLUG: Record<string, { sv: string; en: string }> = {
  shampoo: { sv: "Roots Shampoo", en: "Roots Shampoo" },
  conditioner: { sv: "Roots Conditioner", en: "Roots Conditioner" },
  "body-wash": { sv: "Roots Body Wash", en: "Roots Body Wash" },
  paket: { sv: "Roots Premiumpaket", en: "Roots Premium pack" },
};

/** Short shop/catalog blurbs (DB seeds are Swedish — overlay for EN). */
const DESC_BY_SLUG: Record<string, { sv: string; en: string }> = {
  shampoo: {
    sv: "Rengör på riktigt. Sockerbaserade tensider, SyriCalm®, neutral doft. 250 ml.",
    en: "A real clean. Sugar-based surfactants, SyriCalm®, neutral scent. 250 ml.",
  },
  conditioner: {
    sv: "Mjukt följsamt hår. Panthenol, E-vitamin och SyriCalm®. 250 ml.",
    en: "Soft, smooth hair. Panthenol, vitamin E and SyriCalm®. 250 ml.",
  },
  "body-wash": {
    sv: "Skonsam dusch. Milda tensider, Panthenol och SyriCalm®. 250 ml.",
    en: "A gentle shower. Mild surfactants, panthenol and SyriCalm®. 250 ml.",
  },
  paket: {
    sv: "Tre flaskor. En rutin. Schampo, balsam och body wash. 3 × 250 ml.",
    en: "Three bottles. One routine. Shampoo, conditioner and body wash. 3 × 250 ml.",
  },
};

const BY_SKU: Record<string, { sv: string; en: string }> = {
  "ROOTS-SH-001": BY_SLUG.shampoo,
  "ROOTS-CO-001": BY_SLUG.conditioner,
  "ROOTS-BW-001": BY_SLUG["body-wash"],
  "ROOTS-KIT-001": BY_SLUG.paket,
};

const DESC_BY_SKU: Record<string, { sv: string; en: string }> = {
  "ROOTS-SH-001": DESC_BY_SLUG.shampoo,
  "ROOTS-CO-001": DESC_BY_SLUG.conditioner,
  "ROOTS-BW-001": DESC_BY_SLUG["body-wash"],
  "ROOTS-KIT-001": DESC_BY_SLUG.paket,
};

/** Hair-analysis pack names shown to the end user. */
export const HAIR_PACK_NAMES = {
  maintenance: { sv: "Roots Underhåll", en: "Roots Maintenance" },
  extraMoisture: { sv: "Roots Extra Fukt", en: "Roots Extra Moisture" },
  balanced: { sv: "Roots Balanserad Rutin", en: "Roots Balanced Routine" },
} as const;

export function localizedProductName(
  locale: UiLocale,
  opts: { slug?: string | null; sku?: string | null; fallback: string }
): string {
  if (opts.slug && BY_SLUG[opts.slug]) return BY_SLUG[opts.slug][locale];
  if (opts.sku && BY_SKU[opts.sku]) return BY_SKU[opts.sku][locale];
  // Fallback: map known Swedish bundle name when DB has no slug match.
  if (/komplett\s*paket/i.test(opts.fallback)) {
    return BY_SLUG.paket[locale];
  }
  return opts.fallback;
}

export function localizedProductDescription(
  locale: UiLocale,
  opts: { slug?: string | null; sku?: string | null; fallback: string }
): string {
  if (opts.slug && DESC_BY_SLUG[opts.slug]) {
    return DESC_BY_SLUG[opts.slug][locale];
  }
  if (opts.sku && DESC_BY_SKU[opts.sku]) {
    return DESC_BY_SKU[opts.sku][locale];
  }
  return opts.fallback;
}

export function shippingLineName(locale: UiLocale): string {
  return locale === "en" ? "Shipping" : "Frakt";
}
