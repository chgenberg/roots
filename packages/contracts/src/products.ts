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
 * Paketet med alla tre produkter ligger som en egen rad i `products` — inte i
 * `bundles`.
 *
 * `bundles` beskriver bara vad ett paket innehåller; den är aldrig kopplad till
 * kassan. Orderrader, kundvagnen, avräkningen och Fortnox-artiklarna refererar
 * uteslutande `productId`. Som katalogpost får paketet därför prissättning,
 * orderrader, marginal på faktiskt betalt belopp och fakturarad utan att någon
 * av de vägarna behöver känna till begreppet paket.
 *
 * Priset (399 kr inkl. moms) är lägre än delarna var för sig, så föreningens
 * andel räknas som vanligt på det betalda beloppet.
 */
export const BUNDLE_SKU = "ROOTS-KIT-001";
export const BUNDLE_SLUG = "paket";

/** Sant för katalogposter som är ett paket och inte en enskild produkt. */
export function isBundleSlug(slug: string): boolean {
  return slug === BUNDLE_SLUG;
}
