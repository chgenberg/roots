import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("kontakt", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/kontakt",
    locale,
  });
}

export default async function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = getPage("kontakt", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/kontakt", locale) },
        ]}
      />
      <WebPageJsonLd
        type="ContactPage"
        name={t.title}
        description={t.description}
        url={withLocale("/kontakt", locale)}
        locale={locale}
      />
      {children}
    </>
  );
}
