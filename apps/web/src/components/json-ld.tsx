import { LEGAL_IDENTITY } from "@/lib/legal-identity";
import type { Locale } from "@/i18n/config";

interface OrganizationLdProps {
  name?: string;
  url?: string;
  description?: string;
  locale?: Locale;
}

function schemaLanguage(locale: Locale = "sv"): string {
  return locale === "en" ? "en-GB" : "sv-SE";
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

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

/** Default Offer.priceValidUntil → sista dagen nästa kalenderår. */
function defaultPriceValidUntil(): string {
  return `${new Date().getFullYear() + 1}-12-31`;
}

/**
 * Gemensam script-wrapper för alla JSON-LD-block.
 *
 * JSON.stringify escapar inte `<`, så ett fält med `</script>` (t.ex. produkt-
 * beskrivning från API) kan bryta ut ur script-taggen → XSS. Escapa `<` till
 * `\u003c` (giltig JSON, säkert i HTML).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function OrganizationJsonLd({
  name = LEGAL_IDENTITY.tradingName,
  url = SITE_URL,
  description,
  locale = "sv",
}: OrganizationLdProps) {
  const a = LEGAL_IDENTITY.address;
  const phone = LEGAL_IDENTITY.contact.phone;
  const resolvedDescription =
    description ??
    (locale === "en"
      ? "Natural hair care for sports clubs in Sweden. Premium products sold through club fundraising."
      : "Naturlig hårvård för föreningslivet i Sverige. Premiumprodukter som säljs via föreningsförsäljning.");
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name,
    legalName: LEGAL_IDENTITY.legalName,
    url,
    logo: absoluteUrl("/brand/roots-logo-black.png"),
    description: resolvedDescription,
    areaServed: "SE",
    foundingDate: "2025",
    taxID: LEGAL_IDENTITY.orgNumber,
    email: LEGAL_IDENTITY.contact.email,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      email: LEGAL_IDENTITY.contact.email,
      availableLanguage: locale === "en" ? ["English", "Swedish"] : ["Swedish", "English"],
    },
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

  if (phone) {
    jsonLd.telephone = phone;
  }

  return <JsonLd data={jsonLd} />;
}

interface ProductLdProps {
  name: string;
  description: string;
  sku: string;
  price: number;
  currency?: string;
  image?: string;
  url: string;
  /** ISO-datum (YYYY-MM-DD). Default: 31 dec nästa år. */
  priceValidUntil?: string;
  /** Paketinnehåll — renderas som includesObject TypeAndQuantityNode. */
  includes?: { name: string; url: string; sku: string }[];
  /** Schema.org category, t.ex. "Hårvård". */
  category?: string;
}

export function ProductJsonLd({
  name,
  description,
  sku,
  price,
  currency = "SEK",
  image,
  url,
  priceValidUntil,
  includes,
  category,
}: ProductLdProps) {
  // MASTERPLAN_01 KC7.3: image + url måste vara absolute för att
  // Google ska godkänna rich-result. ProductJsonLd kallas från
  // (marketing)/produkter/[slug] med relativa image-paths som
  // "/images/sport-m3.jpg" — utan denna fix tappar vi product rich snippets.
  const absImage = absoluteUrl(image);
  const absUrl = absoluteUrl(url) ?? url;
  const jsonLd: Record<string, unknown> = {
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
      priceValidUntil: priceValidUntil ?? defaultPriceValidUntil(),
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        "@id": ORG_ID,
        name: LEGAL_IDENTITY.legalName,
      },
    },
  };

  if (category) {
    jsonLd.category = category;
  }

  if (includes && includes.length > 0) {
    jsonLd.includesObject = includes.map((item) => ({
      "@type": "TypeAndQuantityNode",
      amountOfThisGood: 1,
      typeOfGood: {
        "@type": "Product",
        name: item.name,
        sku: item.sku,
        url: absoluteUrl(item.url) ?? item.url,
      },
    }));
  }

  return <JsonLd data={jsonLd} />;
}

/**
 * MASTERPLAN_01 KC7.10: WebSite så Google kan koppla sajten till
 * Organization via @id. SearchAction utelämnas tills vi har en
 * riktig sök-route (tidigare /sok → 404 i sitelink-search).
 */
export function SiteJsonLd({ locale = "sv" }: { locale?: Locale }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: LEGAL_IDENTITY.tradingName,
    alternateName: LEGAL_IDENTITY.legalName,
    url: SITE_URL,
    inLanguage: schemaLanguage(locale),
    publisher: {
      "@id": ORG_ID,
    },
  };
  return <JsonLd data={jsonLd} />;
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url) ?? item.url,
    })),
  };
  return <JsonLd data={jsonLd} />;
}

interface WebPageJsonLdProps {
  name: string;
  description: string;
  url: string;
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage";
  primaryImage?: string;
  speakableCssSelectors?: string[];
  locale?: Locale;
}

export function WebPageJsonLd({
  name,
  description,
  url,
  type = "WebPage",
  primaryImage,
  speakableCssSelectors,
  locale = "sv",
}: WebPageJsonLdProps) {
  const absUrl = absoluteUrl(url) ?? url;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": absUrl,
    name,
    description,
    url: absUrl,
    inLanguage: schemaLanguage(locale),
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };

  const absImage = absoluteUrl(primaryImage);
  if (absImage) {
    jsonLd.primaryImageOfPage = {
      "@type": "ImageObject",
      url: absImage,
    };
  }

  if (speakableCssSelectors && speakableCssSelectors.length > 0) {
    jsonLd.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: speakableCssSelectors,
    };
  }

  return <JsonLd data={jsonLd} />;
}

interface FaqJsonLdProps {
  faqs: { question: string; answer: string }[];
}

export function FaqJsonLd({ faqs }: FaqJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
  return <JsonLd data={jsonLd} />;
}

interface HowToJsonLdProps {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  url?: string;
}

export function HowToJsonLd({ name, description, steps, url }: HowToJsonLdProps) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
  if (url) {
    jsonLd.url = absoluteUrl(url) ?? url;
  }
  return <JsonLd data={jsonLd} />;
}

interface ItemListJsonLdProps {
  name: string;
  items: { name: string; url: string }[];
}

export function ItemListJsonLd({ name, items }: ItemListJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url) ?? item.url,
    })),
  };
  return <JsonLd data={jsonLd} />;
}

interface ArticleJsonLdProps {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  /** @deprecated Author är alltid Organization via @id; prop behålls för bakåtkompatibilitet. */
  authorName?: string;
  speakableCssSelectors?: string[];
  locale?: Locale;
}

const DEFAULT_ARTICLE_SPEAKABLE = [
  "article h1",
  "article .lead",
  "article h2",
];

export function ArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  dateModified,
  image,
  speakableCssSelectors = DEFAULT_ARTICLE_SPEAKABLE,
  locale = "sv",
}: ArticleJsonLdProps) {
  const absUrl = absoluteUrl(url) ?? url;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    url: absUrl,
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: schemaLanguage(locale),
    author: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: LEGAL_IDENTITY.legalName,
    },
    publisher: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: LEGAL_IDENTITY.legalName,
      logo: absoluteUrl("/brand/roots-logo-black.png"),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absUrl,
    },
  };
  const absImage = absoluteUrl(image);
  if (absImage) {
    jsonLd.image = absImage;
  }
  if (speakableCssSelectors.length > 0) {
    jsonLd.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: speakableCssSelectors,
    };
  }
  return <JsonLd data={jsonLd} />;
}
