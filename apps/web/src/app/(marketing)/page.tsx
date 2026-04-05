import { HeroSection } from "@/components/sections/hero";
import { ProductsPreview } from "@/components/sections/products-preview";
import { ForForeningar } from "@/components/sections/for-foreningar";
import { SocialProof } from "@/components/sections/social-proof";
import { Gamification } from "@/components/sections/gamification";
import { FoundersSection } from "@/components/sections/founders";

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
