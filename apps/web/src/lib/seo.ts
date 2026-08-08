import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { withLocale } from "@/i18n/paths";

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
  /** Active marketing locale — prefixes canonical + hreflang. */
  locale?: Locale;
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
  /** ISO-8601. Endast relevant när ogType === "article". */
  publishedTime?: string;
  /** ISO-8601. Endast relevant när ogType === "article". */
  modifiedTime?: string;
  /** Författare (URL eller namn). Endast relevant när ogType === "article". */
  authors?: string[];
}

export function pageMetadata({
  title,
  description,
  path,
  locale = "sv",
  ogImage,
  ogType = "website",
  noindex,
  publishedTime,
  modifiedTime,
  authors,
}: PageMetadataInput): Metadata {
  const canonical = withLocale(path, locale);
  const openGraph =
    ogType === "article"
      ? {
          type: "article" as const,
          url: canonical,
          title,
          description,
          locale: locale === "en" ? "en_GB" : "sv_SE",
          ...(ogImage ? { images: [{ url: ogImage }] } : {}),
          ...(publishedTime ? { publishedTime } : {}),
          ...(modifiedTime ? { modifiedTime } : {}),
          ...(authors ? { authors } : {}),
        }
      : {
          type: "website" as const,
          url: canonical,
          title,
          description,
          locale: locale === "en" ? "en_GB" : "sv_SE",
          ...(ogImage ? { images: [{ url: ogImage }] } : {}),
        };

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        sv: withLocale(path, "sv"),
        en: withLocale(path, "en"),
        "x-default": withLocale(path, "sv"),
      },
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
