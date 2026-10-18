import { BreadcrumbJsonLd, HowToJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";
import { CALCULATOR_DEFAULTS, LOCKED_MARGIN_PERCENT, computeCalculator } from "@roots/contracts";
import { SaFungerarDetClient } from "./sa-fungerar-det-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** En delad kalkyllänk får en egen delningsbild med föreningens siffra. */
function sharedCalcImage(sp: Record<string, string | string[] | undefined>, locale: string) {
  const sellers = Math.round(Number(first(sp.saljare)));
  const avg = Math.round(Number(first(sp.snitt)));
  if (!Number.isFinite(sellers) || sellers < 1 || !Number.isFinite(avg) || avg < 0) return undefined;
  const result = computeCalculator({
    ...CALCULATOR_DEFAULTS,
    sellers: Math.min(1000, sellers),
    avgPerSellerKr: Math.min(5000, avg),
    marginPercent: LOCKED_MARGIN_PERCENT,
  });
  const q = new URLSearchParams({ belopp: String(Math.round(result.earningsKr)), locale });
  const club = first(sp.forening).slice(0, 60);
  if (club) q.set("forening", club);
  return `/og/kalkyl?${q.toString()}`;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("saFungerarDet", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/sa-fungerar-det",
    locale,
    ogImage: sharedCalcImage(await searchParams, locale),
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
