import type { Metadata } from "next";
import { getShop } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

// Checkout är privat köpflöde — noindex även om robots.txt ignoreras.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getShop("checkout", locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default function ShopKassaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
