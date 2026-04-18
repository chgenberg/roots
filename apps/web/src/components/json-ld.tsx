import { LEGAL_IDENTITY } from "@/lib/legal-identity";

interface OrganizationLdProps {
  name?: string;
  url?: string;
  description?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se";

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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku,
    image,
    url,
    brand: { "@type": "Brand", name: LEGAL_IDENTITY.tradingName },
    offers: {
      "@type": "Offer",
      url,
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
