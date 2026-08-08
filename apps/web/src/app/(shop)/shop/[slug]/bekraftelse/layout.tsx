import type { Metadata } from "next";
import { getShop } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

// Orderbekräftelse innehåller personuppgifter — ska aldrig indexeras.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getShop("confirmation", locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default function ShopBekraftelseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
