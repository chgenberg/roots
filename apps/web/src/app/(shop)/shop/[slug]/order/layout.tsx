import type { Metadata } from "next";
import { getShop } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

// Orderstatus är token-/id-skyddad — noindex som defense-in-depth.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getShop("orderStatus", locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default function ShopOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
