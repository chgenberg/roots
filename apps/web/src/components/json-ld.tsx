interface OrganizationLdProps {
  name?: string;
  url?: string;
  description?: string;
}

export function OrganizationJsonLd({
  name = "Roots",
  url = "https://roots.se",
  description = "Naturlig hudvård för föreningslivet i Sverige.",
}: OrganizationLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    description,
    foundingDate: "2025",
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
    brand: { "@type": "Brand", name: "Roots" },
    offers: {
      "@type": "Offer",
      price: (price / 100).toFixed(2),
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
