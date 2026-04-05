import { db } from "./client";
import { organizations, users, products, bundles, bundleProducts } from "./schema";

async function seed() {
  console.log("Seeding database...");

  const [clubOrg] = await db
    .insert(organizations)
    .values({
      name: "Demo Fotbollsklubb",
      orgNumber: "556677-8899",
      type: "club",
    })
    .returning();

  const [salesOrg] = await db
    .insert(organizations)
    .values({
      name: "Roots AB",
      orgNumber: "559900-1122",
      type: "internal",
    })
    .returning();

  // Passwords are "DemoPassword1!" hashed with argon2id (placeholder for seed)
  const passwordHash =
    "$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder";

  await db.insert(users).values([
    {
      email: "klubb@demo.se",
      passwordHash,
      role: "CLUB_ADMIN",
      orgId: clubOrg.id,
      contactName: "Anna Klubbsson",
    },
    {
      email: "salj@roots.se",
      passwordHash,
      role: "SALES_REP",
      orgId: salesOrg.id,
      contactName: "Erik Saljare",
    },
    {
      email: "admin@roots.se",
      passwordHash,
      role: "INTERNAL_ADMIN",
      orgId: salesOrg.id,
      contactName: "Roots Admin",
    },
  ]);

  const [shampoo] = await db
    .insert(products)
    .values({
      sku: "ROOTS-SH-001",
      name: "Roots Shampoo",
      slug: "shampoo",
      description:
        "Naturligt schampo med nordiska botaniska extrakt. Gently cleansing for all hair types.",
      priceOre: 14900,
      currency: "SEK",
    })
    .returning();

  const [conditioner] = await db
    .insert(products)
    .values({
      sku: "ROOTS-CO-001",
      name: "Roots Conditioner",
      slug: "conditioner",
      description:
        "Naturligt balsam som ger mjukt och hanterbart har. Enriched with plant-based oils.",
      priceOre: 14900,
      currency: "SEK",
    })
    .returning();

  const [bodyWash] = await db
    .insert(products)
    .values({
      sku: "ROOTS-BW-001",
      name: "Roots Body Wash",
      slug: "body-wash",
      description:
        "Naturlig kroppstvatt med skonsam rengoring. Fresh Nordic botanicals.",
      priceOre: 12900,
      currency: "SEK",
    })
    .returning();

  const [bundle] = await db
    .insert(bundles)
    .values({
      name: "Roots Complete Kit",
      slug: "complete-kit",
      description: "Schampo, balsam och kroppstvatt i ett komplett paket.",
      priceOre: 39900,
    })
    .returning();

  await db.insert(bundleProducts).values([
    { bundleId: bundle.id, productId: shampoo.id },
    { bundleId: bundle.id, productId: conditioner.id },
    { bundleId: bundle.id, productId: bodyWash.id },
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
