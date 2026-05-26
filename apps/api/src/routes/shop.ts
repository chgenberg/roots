import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  sellers,
  teams,
  campaigns,
  organizations,
  customerOrders,
  products,
  bundles,
  bundleProducts,
} from "@roots/db/schema";
import { childLogger } from "../lib/logger";

const log = childLogger("shop");

export const shop = new Hono();

/**
 * P2.47 (audit 2026-05-26): tidigare exkluderade vår statiska
 * sitemap.ts alla seller-shops vilket gjorde dem osökbara — varje
 * personal shop är en värdefull long-tail SEO-yta. Endpointen
 * returnerar slug + sista uppdaterade ord-datum (heuristik på
 * senaste order) för aktiva sellers i ACTIVE-kampanjer. Vi
 * begränsar till 5 000 rader så Next-sitemap:en håller sig under
 * Google's 50 000-gränsen även när vi växer.
 */
shop.get("/sitemap-shops", async (c) => {
  try {
    const rows = await db
      .select({
        slug: sellers.shopSlug,
        updatedAt: sellers.updatedAt,
      })
      .from(sellers)
      .innerJoin(campaigns, eq(sellers.campaignId, campaigns.id))
      .where(
        and(
          eq(sellers.status, "ACTIVE"),
          eq(campaigns.status, "ACTIVE")
        )
      )
      .limit(5000);

    c.header("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return c.json({ shops: rows });
  } catch (err) {
    log.error({ err }, "sitemap-shops fetch failed");
    return c.json({ shops: [] }, 200);
  }
});

shop.get("/by-slug/:slug", async (c) => {
  const slug = c.req.param("slug");

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.shopSlug, slug))
      .limit(1);

    if (!seller) {
      return c.json({ error: "Shop hittades inte." }, 404);
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    const [org] = team
      ? await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, team.orgId))
          .limit(1)
      : [null];

    const productList = await db.select().from(products).where(eq(products.active, true));
    const bundleList = await db.select().from(bundles);
    const bundleProductLinks = await db.select().from(bundleProducts);

    const soldResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)` })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.sellerId, seller.id),
          eq(customerOrders.status, "PAID")
        )
      );

    const totalSoldOre = Number(soldResult[0]?.total || 0);

    const orderCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customerOrders)
      .where(
        and(
          eq(customerOrders.sellerId, seller.id),
          eq(customerOrders.status, "PAID")
        )
      );

    const orderCount = Number(orderCountResult[0]?.count || 0);

    return c.json({
      seller: {
        id: seller.id,
        displayName: seller.displayName,
        shopSlug: seller.shopSlug,
        individualGoal: seller.individualGoal,
      },
      team: team ? { id: team.id, name: team.name } : null,
      campaign: campaign
        ? {
            id: campaign.id,
            name: campaign.name,
            story: campaign.story,
            description: campaign.description,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            goalType: campaign.goalType,
            goalValue: campaign.goalValue,
            deliveryType: campaign.deliveryType,
            shippingThresholdOre: campaign.shippingThresholdOre,
            shippingFeeOre: campaign.shippingFeeOre,
            status: campaign.status,
          }
        : null,
      organization: org ? { name: org.name } : null,
      products: productList,
      bundles: bundleList.map((b) => ({
        ...b,
        productIds: bundleProductLinks
          .filter((bp) => bp.bundleId === b.id)
          .map((bp) => bp.productId),
      })),
      stats: {
        totalSoldOre,
        orderCount,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch shop by slug");
    return c.json({ error: "Något gick fel." }, 500);
  }
});

shop.get("/products", async (c) => {
  try {
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.active, true));

    const bundleList = await db.select().from(bundles);

    return c.json({ products: productList, bundles: bundleList });
  } catch {
    return c.json({ products: [], bundles: [] });
  }
});
