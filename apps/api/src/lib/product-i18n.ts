import type { UiLocale } from "./ui-locale";

/** Catalog display names for Klarna, emails and order status (not marketing copy). */
const BY_SLUG: Record<string, { sv: string; en: string }> = {
  shampoo: { sv: "Roots Schampoo", en: "Roots Schampoo" },
  conditioner: { sv: "Roots Conditioner", en: "Roots Conditioner" },
  "body-wash": { sv: "Roots Body Wash", en: "Roots Body Wash" },
  paket: { sv: "Roots Komplett paket", en: "Roots Complete pack" },
};

const BY_SKU: Record<string, { sv: string; en: string }> = {
  "ROOTS-SH-001": BY_SLUG.shampoo,
  "ROOTS-CO-001": BY_SLUG.conditioner,
  "ROOTS-BW-001": BY_SLUG["body-wash"],
  "ROOTS-KIT-001": BY_SLUG.paket,
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

export function shippingLineName(locale: UiLocale): string {
  return locale === "en" ? "Shipping" : "Frakt";
}
