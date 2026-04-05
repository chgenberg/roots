import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/club/", "/sales/", "/login", "/registrera"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
