import type { MetadataRoute } from "next";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { GUIDE_SLUGS, guides } from "@/lib/guides";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");
// Server-side fetch, so it needs the backend's absolute URL. `NEXT_PUBLIC_API_URL`
// is the *browser* base and is `/api` in production — relative URLs throw in Node,
// and the catch below would swallow it, silently dropping every shop page.
const API_URL =
  process.env.API_BACKEND_URL ||
  process.env.API_URL ||
  "http://127.0.0.1:4000";

// Render per request: the backend URL only exists at runtime, so a build-time
// prerender would bake in an empty shop list (the fetch below fails and is
// swallowed) and serve it until the next revalidate window.
export const dynamic = "force-dynamic";

interface SitemapShopRow {
  slug: string;
  updatedAt: string | null;
}

async function fetchShopUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API_URL}/v1/shop/sitemap-shops`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { shops?: SitemapShopRow[] };
    return (data.shops ?? []).map((row) => ({
      url: `${BASE_URL}/shop/${encodeURIComponent(row.slug)}`,
      lastModified: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Fail-soft — sitemap utan shop-pages > 500
    return [];
  }
}

function guideEntries(): MetadataRoute.Sitemap {
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  return GUIDE_SLUGS.map((slug) => {
    const meta = bySlug.get(slug);
    return {
      url: `${BASE_URL}/guider/${slug}`,
      lastModified: meta?.updatedAt ? new Date(meta.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/produkter`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/produkter/shampoo`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/produkter/conditioner`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/produkter/body-wash`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/produkter/paket`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/foreningsliv`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/sa-fungerar-det`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/hjalp`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/guider`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    // RSS för guider — discovery för crawlers/LLM:er (även i llms.txt + layout alternates).
    { url: `${BASE_URL}/feed.xml`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/om-oss`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/kontakt`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    // Sidan svarar 404 medan håranalysen är dold — den får inte ligga kvar
    // i sitemapen och bjuda in crawlers till en död URL.
    ...(HAIR_ANALYSIS_ENABLED
      ? [
          {
            url: `${BASE_URL}/haranalys`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        ]
      : []),
    { url: `${BASE_URL}/integritet`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/villkor`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const shopEntries = await fetchShopUrls();
  return [...staticEntries, ...guideEntries(), ...shopEntries];
}
