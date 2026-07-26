import { BUNDLE_SKU, BUNDLE_SLUG, isBundleSlug } from "@roots/contracts";

export { BUNDLE_SKU, BUNDLE_SLUG, isBundleSlug };

/**
 * Presentationsdata för katalogen — bild, typetikett och visningsordning.
 *
 * `products`-tabellen har ingen bildkolumn, så bilderna hör hemma i webben.
 * Kartan låg tidigare i två exemplar: en nycklad på SKU i portalen och en på
 * slug i säljarens shop. Portalens hann rosta — den pekade på /images/p1.jpg,
 * p5.jpg och p6.jpg långt efter att filerna hade bytts ut, så portalen visade
 * gamla flaskor medan shoppen visade de nya. En karta, nycklad på slug (samma
 * nyckel som /produkter/[slug] använder), gör att de inte kan glida isär igen.
 */
const IMAGE_BY_SLUG: Record<string, string> = {
  shampoo: "/images/schampoo.jpg",
  conditioner: "/images/conditioner.jpg",
  "body-wash": "/images/body-wash.jpg",
  [BUNDLE_SLUG]: "/images/collection-4.jpg",
};

/** Kollektionsbilden visar alla tre produkterna — rimlig för okända slugs. */
const DEFAULT_IMAGE = "/images/collection-1.jpg";

export function productImage(slug: string): string {
  return IMAGE_BY_SLUG[slug] ?? DEFAULT_IMAGE;
}

/**
 * Visningsordning i listor. API:et sorterar på namn, vilket skulle lägga
 * paketet mitt bland de enskilda produkterna. Paketet hör sist — man väljer det
 * efter att ha sett vad det innehåller.
 */
const SLUG_ORDER = ["shampoo", "conditioner", "body-wash", BUNDLE_SLUG];

export function byCatalogOrder<T extends { slug: string }>(a: T, b: T): number {
  const rank = (slug: string) => {
    const i = SLUG_ORDER.indexOf(slug);
    return i === -1 ? SLUG_ORDER.length : i;
  };
  return rank(a.slug) - rank(b.slug);
}

export type PortalProductCard = {
  sku: string;
  slug: string;
  name: string;
  type: string;
  desc: string;
  price: number;
  image: string;
  isBundle: boolean;
};

/** Publik produktsida: `/produkter/[slug]` */
export function publicProductHref(slug: string): string {
  return `/produkter/${encodeURIComponent(slug)}`;
}

/** API/DB-radens form från GET /v1/portal/products */
export type ApiProductRow = {
  id?: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  priceOre: number;
};

function typeFromSlug(slug: string): string {
  if (isBundleSlug(slug)) return "Paket — alla tre";
  if (slug.includes("shampoo")) return "Schampo";
  if (slug.includes("conditioner")) return "Balsam";
  if (slug.includes("body")) return "Body Wash";
  return "Produkt";
}

/** Normaliserar en DB/API-produkt till vad portalens produktkort vill ha. */
export function toPortalProductCard(p: ApiProductRow): PortalProductCard {
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    type: typeFromSlug(p.slug),
    desc: p.description?.trim() || "",
    price: Math.round((p.priceOre ?? 0) / 100),
    image: productImage(p.slug),
    isBundle: isBundleSlug(p.slug),
  };
}

/** När API:et inte svarar — slugs matchar marknadssidans `/produkter/[slug]`. */
export const FALLBACK_SKU_SLUG: Record<string, string> = {
  "ROOTS-SH-001": "shampoo",
  "ROOTS-CO-001": "conditioner",
  "ROOTS-BW-001": "body-wash",
  [BUNDLE_SKU]: BUNDLE_SLUG,
};
