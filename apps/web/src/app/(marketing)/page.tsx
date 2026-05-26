import { HeroSection } from "@/components/sections/hero";
import { ProductsPreview } from "@/components/sections/products-preview";
import { ForForeningar } from "@/components/sections/for-foreningar";
import { SocialProof } from "@/components/sections/social-proof";
import { Gamification } from "@/components/sections/gamification";
import { FoundersSection } from "@/components/sections/founders";
import { pageMetadata } from "@/lib/seo";

// MASTERPLAN_01 KC7.4: hemsidan ärver title-template + description från
// root-layouten men måste ändå ha explicit canonical så Google inte
// behandlar "?ref=..." / "?utm=..." som duplicate-content. Vi lämnar
// title undefined → root-default ("Roots — Föreningsnära hudvård").
export const metadata = pageMetadata({
  title: "Naturlig hårvård för föreningslivet",
  description:
    "Roots — naturlig hudvård utvecklad i Norden. Stöd ditt lag eller din förening med varje köp.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <HeroSection />
      <ProductsPreview />
      <ForForeningar />
      <SocialProof />
      <Gamification />
      <FoundersSection />
    </>
  );
}
