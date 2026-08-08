import type { Metadata } from "next";
import { getAuth } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getAuth("register", locale);
  return pageMetadata({
    title: t.metaTitle,
    description: t.metaDescription,
    path: "/registrera",
    locale,
    noindex: true,
  });
}

export default function RegistreraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
