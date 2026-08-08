import { BreadcrumbJsonLd, FaqJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("hjalp", locale);
  return pageMetadata({
    title: t.title,
    description: t.heroBody,
    path: "/hjalp",
    locale,
  });
}

export default async function HjalpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = getPage("hjalp", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;
  const generalFaqs =
    t.sections
      .find((s) => s.id === "general")
      ?.items.map((item) => ({ question: item.q, answer: item.a })) ?? [];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/hjalp", locale) },
        ]}
      />
      <WebPageJsonLd
        name={t.title}
        description={t.heroBody}
        url={withLocale("/hjalp", locale)}
        locale={locale}
      />
      <FaqJsonLd faqs={generalFaqs} />
      {children}
    </>
  );
}
