import type { Metadata } from "next";
import { InterestFlow } from "@/components/interest-flow";
import { InterestSplit } from "@/components/interest-split";
import { getInterest } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getInterest(locale);
  return pageMetadata({
    title: t.metaTitle,
    description: t.metaDescription,
    path: "/intresseanmalan",
    locale,
    ogImage: "/images/roots-club-table-w.jpg",
  });
}

export default async function IntresseanmalanPage() {
  const locale = await getRequestLocale();
  return (
    <InterestSplit locale={locale}>
      <InterestFlow />
    </InterestSplit>
  );
}
