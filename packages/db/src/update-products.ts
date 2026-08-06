/**
 * Idempotent katalogsynk mot live-DB.
 *
 * Sätter namn & beskrivning på befintliga rader (matchar på SKU) och lägger till
 * katalogposter som saknas. `db:seed` vägrar köra i produktion, så det här är
 * vägen in för katalogändringar där.
 *
 * Pris synkas bara när `priceOre` är satt på posten i UPDATES — annars lämnas
 * befintligt pris orört (så en manuell justering i DB inte skrivs över).
 *
 * Kör:
 *   DATABASE_URL="postgres://..." pnpm --filter @roots/db db:update:products
 *
 * Eller direkt:
 *   DATABASE_URL="postgres://..." pnpm --filter @roots/db exec tsx src/update-products.ts
 */
import { eq } from "drizzle-orm";
import { BUNDLE_SKU, BUNDLE_SLUG } from "@roots/contracts";
import { db } from "./client";
import { bundles, products } from "./schema";

type CatalogEntry = {
  sku: string;
  name: string;
  description: string;
  /** Krävs bara för poster som kan behöva skapas. */
  slug?: string;
  priceOre?: number;
};

const UPDATES: CatalogEntry[] = [
  {
    sku: "ROOTS-SH-001",
    name: "Roots Schampoo",
    description:
      "Milt schampo med SyriCalm® som lugnar hårbotten och sulfatsnåla, sockerbaserade tvättämnen. 250 ml.",
  },
  {
    sku: "ROOTS-CO-001",
    name: "Roots Conditioner",
    description:
      "Närande balsam med SyriCalm®, Pro-Vitamin B5 och E-vitamin. Mjukt, följsamt hår utan att tynga. 250 ml.",
  },
  {
    sku: "ROOTS-BW-001",
    name: "Roots Body Wash",
    description:
      "Skonsam kroppstvätt med SyriCalm® och Panthenol. Rengör utan att torka ut. 250 ml.",
  },
  {
    sku: BUNDLE_SKU,
    name: "Roots Komplett paket",
    description:
      "Schampo, balsam och kroppstvätt tillsammans — hela rutinen i ett paket. 3 × 250 ml.",
    slug: BUNDLE_SLUG,
    priceOre: 39900,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL saknas. Sätt den innan du kör skriptet.");
    process.exit(1);
  }

  let updated = 0;
  let created = 0;
  let missing = 0;

  for (const u of UPDATES) {
    const patch: {
      name: string;
      description: string;
      updatedAt: Date;
      priceOre?: number;
    } = {
      name: u.name,
      description: u.description,
      updatedAt: new Date(),
    };
    if (typeof u.priceOre === "number") {
      patch.priceOre = u.priceOre;
    }

    const rows = await db
      .update(products)
      .set(patch)
      .where(eq(products.sku, u.sku))
      .returning({ sku: products.sku, name: products.name, priceOre: products.priceOre });

    if (rows.length > 0) {
      updated += rows.length;
      const priceNote =
        typeof u.priceOre === "number" ? `, ${u.priceOre / 100} kr` : "";
      console.log(`✓ ${u.sku.padEnd(14)} → ${u.name}${priceNote}`);
      continue;
    }

    if (u.slug && u.priceOre) {
      await db.insert(products).values({
        sku: u.sku,
        name: u.name,
        slug: u.slug,
        description: u.description,
        priceOre: u.priceOre,
        currency: "SEK",
      });
      created += 1;
      console.log(`+ ${u.sku.padEnd(14)} → ${u.name} (skapad)`);
      continue;
    }

    missing += 1;
    console.warn(`⚠ ${u.sku.padEnd(14)} hittades inte (0 rader uppdaterade)`);
  }

  // Håller `bundles`-raden i synk med den köpbara paketartikeln. Raden beskriver
  // bara innehållet, men ett avvikande pris där blir förvirrande vid felsökning.
  const bundleEntry = UPDATES.find((u) => u.sku === BUNDLE_SKU);
  if (bundleEntry?.priceOre) {
    const synced = await db
      .update(bundles)
      .set({
        name: bundleEntry.name,
        priceOre: bundleEntry.priceOre,
        updatedAt: new Date(),
      })
      .where(eq(bundles.slug, "complete-kit"))
      .returning({ id: bundles.id });
    if (synced.length > 0) {
      console.log(
        `✓ bundles/complete-kit → ${bundleEntry.name}, ${bundleEntry.priceOre / 100} kr`
      );
    }
  }

  console.log(
    `\nKlart. ${updated} uppdaterade, ${created} skapade${missing ? `, ${missing} saknades` : ""}.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Uppdateringen misslyckades:", err);
  process.exit(1);
});
