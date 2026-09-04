import { HeroSection } from "@/components/sections/hero";
import { ForForeningar } from "@/components/sections/for-foreningar";
import { ProductsPreview } from "@/components/sections/products-preview";
import { Gamification } from "@/components/sections/gamification";
import { FoundersSection } from "@/components/sections/founders";
import { WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { withLocale } from "@/i18n/paths";
import { getRequestLocale } from "@/i18n/request-locale";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title =
    locale === "en"
      ? "Natural hair care for sports clubs"
      : "Naturlig hårvård för föreningslivet";
  const description =
    locale === "en"
      ? "Roots — natural hair care developed in the Nordics. Shampoo, conditioner and body wash that strengthen club fundraising with every purchase."
      : "Roots — naturlig hårvård utvecklad i Norden. Schampo, balsam och body wash som stärker föreningslivet med varje köp.";
  return pageMetadata({ title, description, path: "/", locale });
}

export default async function Home() {
  const locale = await getRequestLocale();
  const title =
    locale === "en"
      ? "Natural hair care for sports clubs"
      : "Naturlig hårvård för föreningslivet";
  const description =
    locale === "en"
      ? "Roots — natural hair care developed in the Nordics. Shampoo, conditioner and body wash that strengthen club fundraising with every purchase."
      : "Roots — naturlig hårvård utvecklad i Norden. Schampo, balsam och body wash som stärker föreningslivet med varje köp.";

  return (
    <>
      <WebPageJsonLd
        name={title}
        description={description}
        url={withLocale("/", locale)}
        locale={locale}
      />
      <HeroSection />
      <ForForeningar />
      <ProductsPreview />
      <Gamification />
      <FoundersSection />
    </>
  );
}
