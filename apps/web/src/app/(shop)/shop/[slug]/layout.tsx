import type { Metadata } from "next";
import { getShop } from "@/i18n/get-dictionary";
import { tFill } from "@/i18n/format";
import { getRequestLocale, LOCALE_HEADER } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";

/**
 * MASTERPLAN_01 KC7.2: per-shop OG/canonical-metadata.
 *
 * page.tsx är "use client" så vi kan inte exportera generateMetadata
 * därifrån. Layouten är server-side, hämtar säljardata via samma API
 * som page.tsx, och bygger en delningskort-vänlig OG + canonical.
 *
 * Tidigare: shop-länkar i Slack/WhatsApp visade root-OG ("Roots —
 * Föreningsnära hårvård") för ALLA säljares shops → omöjligt att se
 * skillnad på Anna-och Bertas länk när vänner får dem.
 *
 * Nu: title = "<displayName> säljer Roots", description = kort
 * org+kampanj-sammanfattning. Fail-soft: om API:t inte svarar returnar
 * vi en generic metadata istället för 500 — Next renderar då page
 * ändå, men utan personlig OG.
 */

interface ShopMetaData {
  seller?: { displayName?: string };
  organization?: { name?: string } | null;
  campaign?: { name?: string; description?: string } | null;
}

async function fetchShop(
  slug: string,
  locale: Awaited<ReturnType<typeof getRequestLocale>>
): Promise<ShopMetaData | null> {
  const base =
    process.env.API_BACKEND_URL ||
    process.env.API_URL ||
    "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/shop/by-slug/${slug}`, {
      // Edge-cache i 5 min — säljardata ändras sällan och delningskort
      // får aldrig blocka shop-besöket. revalidate=300 är en
      // medelväg mellan färskhet och latency.
      next: { revalidate: 300 },
      headers: { [LOCALE_HEADER]: locale },
    });
    if (!res.ok) return null;
    return (await res.json()) as ShopMetaData;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const t = getShop("meta", locale);
  const data = await fetchShop(slug, locale);

  const canonical = withLocale(`/shop/${slug}`, locale);

  if (!data?.seller?.displayName) {
    return {
      title: t.fallbackTitle,
      description: t.fallbackDescription,
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const displayName = data.seller.displayName;
  const orgName = data.organization?.name ?? null;
  const campaignName = data.campaign?.name ?? null;

  const title =
    tFill(t.title, { name: displayName }) +
    (orgName ? tFill(t.titleForOrg, { org: orgName }) : "");

  const description = campaignName
    ? tFill(t.descriptionWithCampaign, {
        name: displayName,
        org: orgName ?? t.orgFallback,
        campaign: campaignName,
      })
    : t.fallbackDescription;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      // Root-layoutens default-image används om vi inte specificerar
      // en egen — det blir en konsekvent Roots-photo istället för
      // en personlig avatar som vi ännu inte lagrar.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
