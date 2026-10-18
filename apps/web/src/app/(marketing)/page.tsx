import { HeroSection } from "@/components/sections/hero";
import { ClubLogos } from "@/components/sections/club-logos";
import { ForForeningar } from "@/components/sections/for-foreningar";
import { DemoTeaser } from "@/components/sections/demo-teaser";
import { WelcomeBack } from "@/components/welcome-back";
import { ProductsPreview } from "@/components/sections/products-preview";
import { PackageShowcase } from "@/components/sections/package-showcase";
import { Gamification } from "@/components/sections/gamification";
import { WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { withLocale } from "@/i18n/paths";
import { getRequestLocale } from "@/i18n/request-locale";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title =
    locale === "en"
      ? "Hair care that clubs sell"
      : "Hårvård som föreningar säljer";
  const description =
    locale === "en"
      ? "Shampoo, conditioner and body wash. Clubs sell Roots and keep 35% of every purchase."
      : "Schampo, balsam och body wash. Föreningar säljer Roots och behåller 35 % av varje köp.";
  return pageMetadata({ title, description, path: "/", locale });
}

export default async function Home() {
  const locale = await getRequestLocale();
  const title =
    locale === "en"
      ? "Hair care that clubs sell"
      : "Hårvård som föreningar säljer";
  const description =
    locale === "en"
      ? "Shampoo, conditioner and body wash. Clubs sell Roots and keep 35% of every purchase."
      : "Schampo, balsam och body wash. Föreningar säljer Roots och behåller 35 % av varje köp.";

  return (
    <>
      <WebPageJsonLd
        name={title}
        description={description}
        url={withLocale("/", locale)}
        locale={locale}
      />
      <HeroSection />
      <ClubLogos />
      <ForForeningar />
      <DemoTeaser />
      <ProductsPreview />
      <PackageShowcase id="paket" className="bg-brand-50/40" />
      <Gamification />
      <WelcomeBack />
    </>
  );
}
