import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("haranalys", locale);
  return pageMetadata({
    title: t.heroTitle,
    description: t.heroBody,
    path: "/haranalys",
    locale,
  });
}

export default function HaranalysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
