import Image from "next/image";
import { Heart, Leaf, Shield } from "lucide-react";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { TeamSection } from "@/components/sections/team";

const PAGE_TITLE = "Om oss";
const PAGE_DESCRIPTION =
  "Teamet bakom Roots — föreningsliv, teknik och naturlig hårvård utvecklad i Norden.";

export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/om-oss",
});

const VALUES = [
  {
    icon: Heart,
    title: "Föreningsdriven",
    description:
      "Allt vi gör har ett mål: att föreningslivet i Sverige ska blomstra. Vårt företag är byggt från grunden med det perspektivet.",
  },
  {
    icon: Leaf,
    title: "Naturligt, inte perfekt",
    description:
      "Vi tror inte på 100% ekologiska certifieringar för certifieringens skull. Vi tror på ingredienser som fungerar och är så naturliga som möjligt.",
  },
  {
    icon: Shield,
    title: "Transparens",
    description:
      "Från ingredienslista till prissättning — vi är öppna med allt. Det är så man bygger förtroende.",
  },
];

export default function OmOssPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Om oss", url: "/om-oss" },
        ]}
      />
      <WebPageJsonLd
        type="AboutPage"
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/om-oss"
      />
      {/* Intro — one composition, brand-led, no dashboard clutter */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#FAF6EF_0%,#F1EBE2_48%,#EDF1E9_100%)]"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 pb-6 pt-20 md:px-10 md:pb-8 md:pt-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">
              Om oss
            </p>
            <h1 className="mt-4 text-[length:var(--font-size-hero)] font-bold tracking-tight">
              Roots
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Naturlig hårvård som kanaliserar vardagsköp tillbaka till
              föreningslivet.
            </p>
          </div>
        </div>
      </section>

      <TeamSection />

      <section className="py-24 md:py-32">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="relative">
            <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src="/images/sport-paddock.jpg"
                alt="Nordisk känsla — ren och naturlig"
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-900/10" />
            </div>
          </div>

          <div className="max-w-lg">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              Historien
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Från en enkel insikt
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Föreningslivet i Sverige ger så mycket till samhället, men får
                alldeles för lite tillbaka. Vi ville ändra på det.
              </p>
              <p>
                Med bakgrunder inom teknik, idrott och företagande satte vi oss
                ner och funderade: vad kan alla föreningar ha gemensamt? Svaret
                var enkelt. Alla duschar. Alla behöver hår- och hudvård.
              </p>
              <p>
                Så vi skapade Roots. Tre naturliga produkter, utvecklade i
                Norden, med en affärsmodell som kanaliserar intäkter tillbaka
                till föreningslivet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-brand-200/60 bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              Värderingar
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Det vi står för
            </h2>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {VALUES.map((v) => (
              <div key={v.title} className="text-center md:text-left">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-700/10 md:mx-0">
                  <v.icon className="h-5 w-5 text-brand-700" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-10">
          <div id="press">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              Press
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Bildmaterial och intervjuer
            </h2>
            <p className="mt-3 text-muted-foreground">
              Kontakta oss på{" "}
              <a
                href="mailto:press@roots.se"
                className="font-medium text-foreground underline decoration-brand-400 underline-offset-4 transition-colors hover:decoration-brand-700"
              >
                press@roots.se
              </a>
              .
            </p>
          </div>
          <div id="jobb">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
              Jobb
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Jobba hos oss
            </h2>
            <p className="mt-3 text-muted-foreground">
              Skicka din ansökan till{" "}
              <a
                href="mailto:jobb@roots.se"
                className="font-medium text-foreground underline decoration-brand-400 underline-offset-4 transition-colors hover:decoration-brand-700"
              >
                jobb@roots.se
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
