import { eq, and } from "drizzle-orm";
import { db } from "@roots/db";
import { products, campaignProducts } from "@roots/db/schema";

/**
 * Vilka produkter en kampanj säljer, och till vilket pris.
 *
 * `campaign_products` fanns i schemat men lästes aldrig: kassan hämtade
 * alla `products.active = true` och använde `product.priceOre`. Det betydde
 * att en klient kunde beställa produkter som inte visas i butiken, och att
 * ett kampanjspecifikt pris (customPriceOre) inte fick någon effekt.
 *
 * Bakåtkompatibelt med avsikt: en kampanj UTAN rader i campaign_products
 * säljer hela den aktiva katalogen till ordinarie pris, precis som förut.
 * Först när föreningen faktiskt kurerat ett urval börjar begränsningen
 * gälla. Annars hade befintliga kampanjer tystnat vid deploy.
 */

export type CatalogProduct = typeof products.$inferSelect & {
  /** customPriceOre när kampanjen satt ett eget pris, annars priceOre. */
  effectivePriceOre: number;
  sortOrder: number;
};

export async function resolveCampaignCatalog(
  campaignId: string
): Promise<Map<string, CatalogProduct>> {
  const scoped = await db
    .select({
      product: products,
      customPriceOre: campaignProducts.customPriceOre,
      sortOrder: campaignProducts.sortOrder,
    })
    .from(campaignProducts)
    .innerJoin(products, eq(products.id, campaignProducts.productId))
    .where(
      and(
        eq(campaignProducts.campaignId, campaignId),
        eq(campaignProducts.active, true),
        eq(products.active, true)
      )
    );

  if (scoped.length > 0) {
    return new Map(
      scoped.map((row) => [
        row.product.id,
        {
          ...row.product,
          effectivePriceOre: row.customPriceOre ?? row.product.priceOre,
          sortOrder: row.sortOrder,
        },
      ])
    );
  }

  const all = await db.select().from(products).where(eq(products.active, true));
  return new Map(
    all.map((p) => [
      p.id,
      { ...p, effectivePriceOre: p.priceOre, sortOrder: 0 },
    ])
  );
}

/** Sorterad lista för presentation (butik, portal). */
export function catalogToList(
  catalog: Map<string, CatalogProduct>
): CatalogProduct[] {
  return [...catalog.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv")
  );
}
