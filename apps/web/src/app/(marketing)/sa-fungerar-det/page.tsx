import { BreadcrumbJsonLd, HowToJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { SaFungerarDetClient } from "./sa-fungerar-det-client";

const PAGE_TITLE = "Så fungerar det";
const PAGE_DESCRIPTION =
  "Se hur Roots fungerar för föreningar i tre enkla steg — och räkna ut vad försäljningen kan ge er förening. Inga pärmar, inga kontanter.";

export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/sa-fungerar-det",
});

/** Speglar de tre STEPS i sa-fungerar-det-client (server-side för JSON-LD). */
const HOW_TO_STEPS = [
  {
    name: "Föreningen kommer igång",
    text: "Föreningsansvarig loggar in, sätter ett mål och öppnar en säljperiod. Allt syns live i dashboarden — ni ser exakt hur långt ni har kvar.",
  },
  {
    name: "Lagledaren bjuder in laget",
    text: "Tränaren eller föräldragruppen skickar en registreringslänk till spelarna och peppar laget via topplistan — utan att hålla i någon pärm.",
  },
  {
    name: "Medlemmen säljer",
    text: "Spelaren får sin egen personliga shop-länk. Hen delar den med släkt och vänner — som handlar med Swish eller kort på några sekunder.",
  },
];

export default function SaFungerarDetPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Så fungerar det", url: "/sa-fungerar-det" },
        ]}
      />
      <WebPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/sa-fungerar-det"
      />
      <HowToJsonLd
        name="Så fungerar Roots"
        description="Hur Roots fungerar för föreningar i tre enkla steg — från start till försäljning."
        url="/sa-fungerar-det"
        steps={HOW_TO_STEPS}
      />
      <SaFungerarDetClient />
    </>
  );
}
