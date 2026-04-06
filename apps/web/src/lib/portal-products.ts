/** Map seeded SKUs to marketing images under /public/images */
const IMAGE_BY_SKU: Record<string, string> = {
  "ROOTS-SH-001": "/images/p1.jpg",
  "ROOTS-CO-001": "/images/p5.jpg",
  "ROOTS-BW-001": "/images/p6.jpg",
};

const DEFAULT_IMAGE = "/images/p1.jpg";

export type PortalProductCard = {
  sku: string;
  name: string;
  type: string;
  desc: string;
  price: number;
  image: string;
};

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
    name: p.name,
    type: typeFromSlug(p.slug),
    desc: p.description?.trim() || "",
    price,
    image: IMAGE_BY_SKU[p.sku] ?? DEFAULT_IMAGE,
  };
}
