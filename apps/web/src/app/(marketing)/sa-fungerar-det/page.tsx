import { BreadcrumbJsonLd, HowToJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";
import { SaFungerarDetClient } from "./sa-fungerar-det-client";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("saFungerarDet", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/sa-fungerar-det",
    locale,
  });
}

export default async function SaFungerarDetPage() {
  const locale = await getRequestLocale();
  const t = getPage("saFungerarDet", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  const howToSteps = t.steps.map((s) => ({
    name: s.title,
    text: s.description,
  }));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/sa-fungerar-det", locale) },
        ]}
      />
      <WebPageJsonLd
        name={t.title}
        description={t.description}
        url={withLocale("/sa-fungerar-det", locale)}
        locale={locale}
      />
      <HowToJsonLd
        name={t.howToName}
        description={t.howToDescription}
        url={withLocale("/sa-fungerar-det", locale)}
        steps={howToSteps}
      />
      <SaFungerarDetClient />
    </>
  );
}
