import { products as productDict } from "@/i18n/dictionaries/products";
import type { ProductSlug } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

const BY_SKU: Record<string, ProductSlug> = {
  "ROOTS-SH-001": "shampoo",
  "ROOTS-CO-001": "conditioner",
  "ROOTS-BW-001": "body-wash",
  "ROOTS-KIT-001": "paket",
};

/**
 * Display name for catalog products. Prefer slug/SKU; fall back to matching
 * known Swedish DB names (e.g. Roots Komplett paket) for English UI.
 */
export function displayProductName(
  locale: Locale,
  opts: {
    slug?: string | null;
    sku?: string | null;
    name?: string | null;
  }
): string {
  const fallback = opts.name?.trim() || "";
  if (opts.slug && opts.slug in productDict) {
    return productDict[opts.slug as ProductSlug][locale].name;
  }
  if (opts.sku && BY_SKU[opts.sku]) {
    return productDict[BY_SKU[opts.sku]][locale].name;
  }
  if (locale === "en" && /komplett\s*paket/i.test(fallback)) {
    return productDict.paket.en.name;
  }
  return fallback;
}
