import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop/"],
        // Personal shops should be indexable to help viral discovery, but
        // authenticated portal surfaces, internal tooling and auth pages stay
        // blocked from crawlers.
        disallow: [
          "/api/",
          "/trpc/",
          "/portal/",
          "/forening/",
          "/lag/",
          "/min-shop/",
          // P3.57 (audit 2026-05-26): /konto/avbryt-radering länkar
          // innehåller HMAC-token; crawler-besök som följer länken
          // riskerar att aktivera token:en eller exponera den i logs.
          "/konto/",
          "/login",
          "/registrera",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
