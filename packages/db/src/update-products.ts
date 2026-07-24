/**
 * Idempotent uppdatering av produkternas namn & beskrivning i live-DB.
 *
 * Sätter de nya Syricalm-namnen/texterna på befintliga rader (matchar på SKU).
 * Rör INTE pris, slug eller active. Säker att köra hur många gånger som helst.
 *
 * Kör:
 *   DATABASE_URL="postgres://..." pnpm --filter @roots/db db:update:products
 *
 * Eller direkt:
 *   DATABASE_URL="postgres://..." pnpm --filter @roots/db exec tsx src/update-products.ts
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { products } from "./schema";

const UPDATES: { sku: string; name: string; description: string }[] = [
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
      "Närande balsam med SyriCalm®, Pro-Vitamin B5 och E-vitamin. Mjukt, följsamt hår utan att tynga. 200 ml.",
  },
  {
    sku: "ROOTS-BW-001",
    name: "Roots Body Wash",
    description:
      "Skonsam kroppstvätt med SyriCalm® och Panthenol. Rengör utan att torka ut. 250 ml.",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL saknas. Sätt den innan du kör skriptet.");
    process.exit(1);
  }

  let updated = 0;
  let missing = 0;

  for (const u of UPDATES) {
    const rows = await db
      .update(products)
      .set({ name: u.name, description: u.description, updatedAt: new Date() })
      .where(eq(products.sku, u.sku))
      .returning({ sku: products.sku, name: products.name });

    if (rows.length > 0) {
      updated += rows.length;
      console.log(`✓ ${u.sku.padEnd(14)} → ${u.name}`);
    } else {
      missing += 1;
      console.warn(`⚠ ${u.sku.padEnd(14)} hittades inte (0 rader uppdaterade)`);
    }
  }

  console.log(`\nKlart. ${updated} produkt(er) uppdaterade${missing ? `, ${missing} saknades` : ""}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Uppdateringen misslyckades:", err);
  process.exit(1);
});
