/** Map seeded SKUs to marketing images under /public/images */
const IMAGE_BY_SKU: Record<string, string> = {
  "ROOTS-SH-001": "/images/p1.jpg",
  "ROOTS-CO-001": "/images/p5.jpg",
  "ROOTS-BW-001": "/images/p6.jpg",
};

const DEFAULT_IMAGE = "/images/p1.jpg";

export type PortalProductCard = {
  sku: string;
  slug: string;
  name: string;
  type: string;
  desc: string;
  price: number;
  image: string;
};

/** Public marketing product page: `/produkter/[slug]` */
export function publicProductHref(slug: string): string {
  return `/produkter/${encodeURIComponent(slug)}`;
}

/** API / DB row shape from GET /v1/portal/products */
export type ApiProductRow = {
  id?: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  priceOre: number;
};

function typeFromSlug(slug: string): string {
  if (slug.includes("shampoo")) return "Schampo";
  if (slug.includes("conditioner")) return "Balsam";
  if (slug.includes("body")) return "Body Wash";
  return "Produkt";
}

/** Normalize DB/API product into what portal product cards expect */
export function toPortalProductCard(p: ApiProductRow): PortalProductCard {
  const price = Math.round((p.priceOre ?? 0) / 100);
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    type: typeFromSlug(p.slug),
    desc: p.description?.trim() || "",
    price,
    image: IMAGE_BY_SKU[p.sku] ?? DEFAULT_IMAGE,
  };
}

/** When API is unavailable — slugs match marketing `/produkter/[slug]`. */
export const FALLBACK_SKU_SLUG: Record<string, string> = {
  "ROOTS-SH-001": "shampoo",
  "ROOTS-CO-001": "conditioner",
  "ROOTS-BW-001": "body-wash",
};
