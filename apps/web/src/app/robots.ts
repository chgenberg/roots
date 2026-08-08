import type { MetadataRoute } from "next";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop/"],
        // Personal shops should be indexable to help viral discovery, but
        // authenticated portal surfaces, internal tooling and auth pages stay
        // blocked from crawlers.
        //
        // AI-crawlers (GPTBot, ClaudeBot, Google-Extended m.fl.) tillåts
        // medvetet på publik marknadsföring — intentional LLM SEO. De
        // träffas av samma disallow-lista nedan för auth/kassa/portal.
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
          "/glomt-losenord",
          "/aterstall-losenord",
          "/preview-gate",
          "/kalkylator/",
          // Shop-checkout & orderflöde (Google stödjer * i robots.txt).
          // Mönster matchar /shop/[slug]/kassa|bekraftelse|order/...
          "/*/kassa",
          "/*/bekraftelse",
          "/shop/*/order/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
