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
          "/sales/",
          "/portal/",
          "/forening/",
          "/lag/",
          "/min-shop/",
          "/login",
          "/registrera",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
