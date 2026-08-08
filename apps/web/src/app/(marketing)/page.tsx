import { HeroSection } from "@/components/sections/hero";
import { ProductsPreview } from "@/components/sections/products-preview";
import { ForForeningar } from "@/components/sections/for-foreningar";
import { SocialProof } from "@/components/sections/social-proof";
import { Gamification } from "@/components/sections/gamification";
import { FoundersSection } from "@/components/sections/founders";
import { WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";

const PAGE_TITLE = "Naturlig hårvård för föreningslivet";
const PAGE_DESCRIPTION =
  "Roots — naturlig hårvård utvecklad i Norden. Schampo, balsam och body wash som stärker föreningslivet med varje köp.";

// MASTERPLAN_01 KC7.4: hemsidan ärver title-template + description från
// root-layouten men måste ändå ha explicit canonical så Google inte
// behandlar "?ref=..." / "?utm=..." som duplicate-content. Vi lämnar
// title undefined → root-default ("Roots — Föreningsnära hårvård").
export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/",
});

export default function Home() {
  return (
    <>
      <WebPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/"
      />
      <HeroSection />
      <ProductsPreview />
      <ForForeningar />
      <SocialProof />
      <Gamification />
      <FoundersSection />
    </>
  );
}
