import type { Metadata } from "next";

/**
 * MASTERPLAN_01 KC7.4 + KC7.5: standard-helper för per-page metadata.
 *
 * Varje public-page bör kalla `pageMetadata({ ... })` istället för att
 * handcraft:a en `Metadata`-objekt. Det säkerställer:
 *
 *   - `alternates.canonical` är satt → inga duplicate-content-flaggor
 *     från Google när sidan nås via t.ex. utm-parametrar.
 *   - `openGraph` får både title + description + image så preview-cards
 *     på Slack/LinkedIn/iMessage ser professionella ut.
 *   - `twitter` kortet matchar OG-image så delningar är konsekventa.
 *
 * Root-layouten har redan `metadataBase` så att relativa paths som
 * "/integritet" auto-resolveas mot NEXT_PUBLIC_SITE_URL.
 *
 * Användning:
 *   export const metadata = pageMetadata({
 *     title: "Integritet",
 *     description: "...",
 *     path: "/integritet",
 *   });
 */
export interface PageMetadataInput {
  title: string;
  description: string;
  /** Absolute path (måste börja med "/"). Används till canonical + openGraph.url. */
  path: string;
  /** Default: "/images/sport-h1desktop.jpg" (root-layoutens fallback). Relativa paths OK. */
  ogImage?: string;
  /**
   * Next.js OpenGraph-typningen accepterar bara "website" | "article".
   * Produkter ska istället få JSON-LD via `ProductJsonLd` — OG-typen
   * stannar som "website" eller "article".
   */
  ogType?: "website" | "article";
  /** Lägg `noindex: true` på sidor som inte ska indexeras (t.ex. /preview-gate). */
  noindex?: boolean;
}

export function pageMetadata({
  title,
  description,
  path,
  ogImage,
  ogType = "website",
  noindex,
}: PageMetadataInput): Metadata {
  const canonical = path;
  // metadataBase i root-layout gör absolute-resolution åt oss; vi
  // skickar bara relativ path så samma kod fungerar i preview-deploys
  // utan att läcka prod-URL.
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: ogType,
      url: canonical,
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
