import type { Metadata } from "next";

interface Params {
  slug: string;
}

async function fetchShopName(slug: string): Promise<string | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.API_BASE_URL ||
      "http://localhost:4000";
    const res = await fetch(`${base}/v1/shop/by-slug/${slug}`, {
      // Supporter pages change only when the seller edits their shop, so a
      // short ISR-style cache is plenty.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      seller?: { displayName?: string };
      campaign?: { name?: string };
    };
    const seller = data.seller?.displayName;
    const campaign = data.campaign?.name;
    if (seller && campaign) return `${seller} — ${campaign}`;
    return seller || campaign || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = await fetchShopName(slug);
  const title = name
    ? `${name} | Stötta via Roots`
    : "Stötta en förening via Roots";
  const description = name
    ? `Beställ naturlig hårvård och kroppstvätt från ${name}. En del av köpet går tillbaka till föreningen.`
    : "Beställ naturlig hårvård och kroppstvätt direkt via en säljares personliga shop. En del av köpet går tillbaka till föreningen.";

  return {
    title,
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: {
      title,
      description,
      url: `/shop/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function SellerShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
