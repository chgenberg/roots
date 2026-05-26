import { LEGAL_IDENTITY } from "@/lib/legal-identity";

interface OrganizationLdProps {
  name?: string;
  url?: string;
  description?: string;
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");

/**
 * MASTERPLAN_01 KC7.3: Google ignorerar JSON-LD images som inte är
 * absolute URLs. Den här helpern prefixar med SITE_URL om värdet
 * börjar med "/" — men låter redan-absoluta URLer (eller protocol-
 * relative) passera oförändrade.
 */
function absoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return value;
}

export function OrganizationJsonLd({
  name = LEGAL_IDENTITY.tradingName,
  url = SITE_URL,
  description = "Naturlig hudvård för föreningslivet i Sverige.",
}: OrganizationLdProps) {
  const a = LEGAL_IDENTITY.address;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    legalName: LEGAL_IDENTITY.legalName,
    url,
    description,
    foundingDate: "2025",
    vatID: LEGAL_IDENTITY.vatId,
    taxID: LEGAL_IDENTITY.orgNumber,
    email: LEGAL_IDENTITY.contact.email,
    telephone: LEGAL_IDENTITY.contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: a.street,
      postalCode: a.postalCode,
      addressLocality: a.city,
      addressCountry: a.countryCode,
    },
    sameAs: [LEGAL_IDENTITY.social.instagram, LEGAL_IDENTITY.social.linkedin],
    numberOfEmployees: { "@type": "QuantitativeValue", value: 3 },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface ProductLdProps {
  name: string;
  description: string;
  sku: string;
  price: number;
  currency?: string;
  image?: string;
  url: string;
}

export function ProductJsonLd({
  name,
  description,
  sku,
  price,
  currency = "SEK",
  image,
  url,
}: ProductLdProps) {
  // MASTERPLAN_01 KC7.3: image + url måste vara absolute för att
  // Google ska godkänna rich-result. ProductJsonLd kallas från
  // (marketing)/produkter/[slug] med relativa image-paths som
  // "/images/m3.jpg" — utan denna fix tappar vi product rich snippets.
  const absImage = absoluteUrl(image);
  const absUrl = absoluteUrl(url) ?? url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku,
    image: absImage,
    url: absUrl,
    brand: { "@type": "Brand", name: LEGAL_IDENTITY.tradingName },
    offers: {
      "@type": "Offer",
      url: absUrl,
      price: (price / 100).toFixed(2),
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: LEGAL_IDENTITY.legalName,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * MASTERPLAN_01 KC7.10: WebSite + SearchAction så Google sitelink-
 * search-box renderas under varumärket vid brand-sökning.
 * Search-target pekar på vår public-search-route — den finns ännu
 * inte men URL-shape är public-API:t och kan stå redo.
 */
export function SiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: LEGAL_IDENTITY.tradingName,
    alternateName: LEGAL_IDENTITY.legalName,
    url: SITE_URL,
    inLanguage: "sv-SE",
    publisher: {
      "@type": "Organization",
      name: LEGAL_IDENTITY.legalName,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/sok?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
