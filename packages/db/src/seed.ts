import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db } from "./client";
import {
  organizations,
  users,
  products,
  bundles,
  bundleProducts,
} from "./schema";

/** Same as `apps/api/src/routes/auth.ts` — login must verify with these options. */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

/** Matches in-memory demo accounts in auth (when not production). */
const DEMO_PASSWORD = "Demo1234!";

async function ensureOrg(values: {
  name: string;
  orgNumber: string | null;
  type: string;
}) {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, values.name))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(organizations).values(values).returning();
  return created;
}

async function syncDemoUser(values: {
  email: string;
  passwordHash: string;
  role:
    | "CLUB_ADMIN"
    | "SALES_REP"
    | "INTERNAL_ADMIN";
  orgId: string;
  contactName: string;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, values.email))
    .limit(1);
  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash: values.passwordHash,
        role: values.role,
        orgId: values.orgId,
        contactName: values.contactName,
      })
      .where(eq(users.email, values.email));
    console.log(`Updated demo user (password + profile): ${values.email}`);
    return;
  }
  await db.insert(users).values(values);
  console.log(`Created user: ${values.email}`);
}

async function seed() {
  console.log("Seeding database...");

  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

  const clubOrg = await ensureOrg({
    name: "Demo Fotbollsklubb",
    orgNumber: "556677-8899",
    type: "club",
  });

  const salesOrg = await ensureOrg({
    name: "Roots AB",
    orgNumber: "559900-1122",
    type: "internal",
  });

  await syncDemoUser({
    email: "klubb@demo.se",
    passwordHash,
    role: "CLUB_ADMIN",
    orgId: clubOrg.id,
    contactName: "Anna Klubbsson",
  });

  await syncDemoUser({
    email: "salj@roots.se",
    passwordHash,
    role: "SALES_REP",
    orgId: salesOrg.id,
    contactName: "Erik Säljare",
  });

  await syncDemoUser({
    email: "admin@roots.se",
    passwordHash,
    role: "INTERNAL_ADMIN",
    orgId: salesOrg.id,
    contactName: "Roots Admin",
  });

  const productSeeds = [
    {
      sku: "ROOTS-SH-001",
      name: "Roots Schampoo",
      slug: "shampoo",
      description:
        "Milt schampo med SyriCalm® som lugnar hårbotten och sulfatsnåla, sockerbaserade tvättämnen. 250 ml.",
      priceOre: 14900,
      currency: "SEK",
    },
    {
      sku: "ROOTS-CO-001",
      name: "Roots Conditioner",
      slug: "conditioner",
      description:
        "Närande balsam med SyriCalm®, Pro-Vitamin B5 och E-vitamin. Mjukt, följsamt hår utan att tynga. 200 ml.",
      priceOre: 14900,
      currency: "SEK",
    },
    {
      sku: "ROOTS-BW-001",
      name: "Roots Body Wash",
      slug: "body-wash",
      description:
        "Skonsam kroppstvätt med SyriCalm® och Panthenol. Rengör utan att torka ut. 250 ml.",
      priceOre: 12900,
      currency: "SEK",
    },
  ] as const;

  const insertedProducts: { id: string; sku: string }[] = [];
  for (const p of productSeeds) {
    const [exists] = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.sku, p.sku))
      .limit(1);
    if (exists) {
      console.log(`Product ${p.sku} already exists (skip)`);
      insertedProducts.push(exists);
      continue;
    }
    const [row] = await db.insert(products).values(p).returning({
      id: products.id,
      sku: products.sku,
    });
    insertedProducts.push(row);
    console.log(`Created product: ${p.sku}`);
  }

  const [bundleExists] = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(eq(bundles.slug, "complete-kit"))
    .limit(1);

  if (!bundleExists) {
    const [bundle] = await db
      .insert(bundles)
      .values({
        name: "Roots Complete Kit",
        slug: "complete-kit",
        description: "Schampo, balsam och kroppstvatt i ett komplett paket.",
        priceOre: 39900,
      })
      .returning();

    const bySku = new Map(insertedProducts.map((r) => [r.sku, r.id]));
    const shampooId = bySku.get("ROOTS-SH-001");
    const conditionerId = bySku.get("ROOTS-CO-001");
    const bodyWashId = bySku.get("ROOTS-BW-001");
    if (shampooId && conditionerId && bodyWashId) {
      await db.insert(bundleProducts).values([
        { bundleId: bundle.id, productId: shampooId },
        { bundleId: bundle.id, productId: conditionerId },
        { bundleId: bundle.id, productId: bodyWashId },
      ]);
    }
    console.log("Created bundle: complete-kit");
  } else {
    console.log("Bundle complete-kit already exists (skip)");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
