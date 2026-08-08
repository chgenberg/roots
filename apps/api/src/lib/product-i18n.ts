import type { UiLocale } from "./ui-locale";

/** Catalog display names for Klarna, emails and order status (not marketing copy). */
const BY_SLUG: Record<string, { sv: string; en: string }> = {
  shampoo: { sv: "Roots Schampoo", en: "Roots Schampoo" },
  conditioner: { sv: "Roots Conditioner", en: "Roots Conditioner" },
  "body-wash": { sv: "Roots Body Wash", en: "Roots Body Wash" },
  paket: { sv: "Roots Komplett paket", en: "Roots Complete pack" },
};

/** Short shop/catalog blurbs (DB seeds are Swedish — overlay for EN). */
const DESC_BY_SLUG: Record<string, { sv: string; en: string }> = {
  shampoo: {
    sv: "Milt schampo med SyriCalm® som lugnar hårbotten och sulfatsnåla, sockerbaserade tvättämnen. 250 ml.",
    en: "Gentle shampoo with SyriCalm® that soothes the scalp, plus low-sulphate, sugar-based cleansers. 250 ml.",
  },
  conditioner: {
    sv: "Närande balsam med SyriCalm®, Pro-Vitamin B5 och E-vitamin. Mjukt, följsamt hår utan att tynga. 250 ml.",
    en: "Nourishing conditioner with SyriCalm®, pro-vitamin B5 and vitamin E. Soft, manageable hair without weighing it down. 250 ml.",
  },
  "body-wash": {
    sv: "Skonsam kroppstvätt med SyriCalm® och Panthenol. Rengör utan att torka ut. 250 ml.",
    en: "Gentle body wash with SyriCalm® and panthenol. Cleanses without drying the skin. 250 ml.",
  },
  paket: {
    sv: "Schampo, balsam och kroppstvätt tillsammans — hela rutinen i ett paket. 3 × 250 ml.",
    en: "Shampoo, conditioner and body wash together — the full routine in one pack. 3 × 250 ml.",
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
  if (locale === "en" && /komplett\s*paket/i.test(opts.fallback)) {
    return BY_SLUG.paket.en;
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
