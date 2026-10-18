import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceOre: z.number().int().positive(),
  currency: z.string().default("SEK"),
  active: z.boolean().default(true),
});

export type Product = z.infer<typeof ProductSchema>;

export const BundleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  priceOre: z.number().int().positive(),
  products: z.array(ProductSchema),
});

export type Bundle = z.infer<typeof BundleSchema>;

/**
 * Paketen (Basic, Premium, Exclusive) ligger som egna rader i `products` —
 * inte i `bundles`.
 *
 * `bundles` beskriver bara vad ett paket innehåller; den är aldrig kopplad till
 * kassan. Orderrader, kundvagnen, avräkningen och Fortnox-artiklarna refererar
 * uteslutande `productId`. Som katalogpost får varje paket därför prissättning,
 * orderrader, marginal på faktiskt betalt belopp och fakturarad utan att någon
 * av de vägarna behöver känna till begreppet paket.
 *
 * Paketpriset (299/399/499 kr inkl. moms) är lägre än delarna var för sig, så
 * föreningens andel räknas som vanligt på det betalda beloppet.
 */
export const BUNDLE_SKU = "ROOTS-KIT-001";
export const BUNDLE_SLUG = "paket";

/** Basic: schampo + balsam, 299 kr. */
export const BASIC_BUNDLE_SKU = "ROOTS-KIT-002";
export const BASIC_BUNDLE_SLUG = "paket-basic";

/** Exclusive: två schampo + balsam + body wash, 499 kr. */
export const EXCLUSIVE_BUNDLE_SKU = "ROOTS-KIT-003";
export const EXCLUSIVE_BUNDLE_SLUG = "paket-exclusive";

/**
 * Vad varje paket innehåller, som produkt-slug → antal flaskor. Premium
 * (`BUNDLE_SLUG`) är paketet vi lyfter fram; de andra två finns bredvid.
 */
export const BUNDLE_CONTENTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  [BASIC_BUNDLE_SLUG]: { shampoo: 1, conditioner: 1 },
  [BUNDLE_SLUG]: { shampoo: 1, conditioner: 1, "body-wash": 1 },
  [EXCLUSIVE_BUNDLE_SLUG]: { shampoo: 2, conditioner: 1, "body-wash": 1 },
};

/** Alla paket-slugs, i prisordning. */
export const BUNDLE_SLUGS = [BASIC_BUNDLE_SLUG, BUNDLE_SLUG, EXCLUSIVE_BUNDLE_SLUG] as const;

/** Sant för katalogposter som är ett paket och inte en enskild produkt. */
export function isBundleSlug(slug: string): boolean {
  return Object.hasOwn(BUNDLE_CONTENTS, slug);
}

/**
 * Vad paketets flaskor kostar var för sig, i samma enhet som `priceBySlug`.
 * `null` när paketet är okänt eller någon av flaskorna saknas i katalogen.
 */
export function bundlePartsPrice(
  slug: string,
  priceBySlug: Readonly<Record<string, number>>
): number | null {
  const contents = BUNDLE_CONTENTS[slug];
  if (!contents) return null;
  let sum = 0;
  for (const [part, qty] of Object.entries(contents)) {
    const price = priceBySlug[part];
    if (price === undefined) return null;
    sum += price * qty;
  }
  return sum;
}
