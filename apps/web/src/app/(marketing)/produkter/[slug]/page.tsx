import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductJsonLd } from "@/components/json-ld";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BUNDLE_SKU, BUNDLE_SLUG } from "@/lib/product-catalog";

const PRODUCTS: Record<
  string,
  {
    name: string;
    /** Riktig katalog-SKU — går ut i strukturerad data, så den får inte gissas. */
    sku: string;
    tagline: string;
    description: string;
    price: string;
    priceOre: number;
    volume: string;
    image: string;
    image2: string;
    highlights: string[];
    /** Enskilda produkter har en INCI-lista; paketet har `contains` istället. */
    ingredients?: string[];
    contains?: { slug: string; label: string }[];
  }
> = {
  shampoo: {
    name: "Roots Schampoo",
    sku: "ROOTS-SH-001",
    tagline: "Schampo som rengör på riktigt — och lämnar hårbotten i ro",
    description:
      "Ett mjukt men effektivt schampo som löser smuts och fett utan att skala bort hårbottnens naturliga balans. Sockerbaserade, sulfatsnåla tvättämnen rengör skonsamt medan SyriCalm® — en forskningsförankrad nordisk aktiv av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och stärker hårbotten. Polyquaternium reder ut och ger naturlig glans. Håret känns rent, lätt och levande, dag efter dag.",
    price: "149 kr",
    priceOre: 14900,
    volume: "250 ml",
    image: "/images/schampoo.jpg",
    image2: "/images/schampoo-lifestyle.jpg",
    highlights: ["Sulfatsnålt", "SyriCalm® – lugnar hårbotten", "Reder ut & ger glans"],
    ingredients: [
      "Aqua", "Coco-Glucoside", "Cocamidopropyl Betaine",
      "Disodium Lauryl Sulfosuccinate", "Glycerin", "Sodium Chloride",
      "PEG-4 Rapeseedamide", "Sodium Benzoate", "Citric Acid",
      "Potassium Sorbate", "Parfum", "Polyquaternium-10", "Polyquaternium-7",
      "Sodium Citrate", "Phragmites Communis Extract", "Poria Cocos Extract",
      "Octadecyl Di-t-Butyl-4-Hydroxyhydrocinnamate", "Sodium Hydroxide",
    ],
  },
  conditioner: {
    name: "Roots Conditioner",
    sku: "ROOTS-CO-001",
    tagline: "Balsam som ger håret exakt det det behöver — inget mer, inget mindre",
    description:
      "Ett närande balsam som gör håret mjukt, följsamt och lätt att reda ut utan att tynga ner. Ett lätt emollient-komplex och Pro-Vitamin B5 (Panthenol) återfuktar på djupet, medan E-vitamin och antioxidanter från svartpeppar (Piper Nigrum) och Inga-bark skyddar håret mot daglig miljöstress. SyriCalm® lugnar hårbotten. Resultatet: silkeslent hår med en lyster som håller hela dagen.",
    price: "149 kr",
    priceOre: 14900,
    volume: "250 ml",
    image: "/images/conditioner.jpg",
    image2: "/images/conditioner-lifestyle.jpg",
    highlights: ["SyriCalm® & Panthenol", "E-vitamin & antioxidanter", "Närande – utan att tynga"],
    ingredients: [
      "Aqua", "Cetearyl Alcohol", "Caprylic/Capric Triglyceride",
      "Distearoylethyl Hydroxyethylmonium Methosulfate",
      "Stearamidopropyl Dimethylamine", "Phenoxyethanol", "Panthenol",
      "Hydrolyzed Corn Starch", "Beta Vulgaris Root Extract", "Butylene Glycol",
      "Parfum", "Citric Acid", "Benzoic Acid", "Sodium Lauroyl Lactylate",
      "Sodium Caproyl Lactylate", "Dehydroacetic Acid", "Lactic Acid",
      "Ethylhexylglycerin", "Sodium Citrate", "Piper Nigrum Fruit Extract",
      "Phragmites Communis Extract", "Poria Cocos Extract", "Sodium Benzoate",
      "Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate",
      "Inga Alba Bark Extract", "Tocopherol",
    ],
  },
  "body-wash": {
    name: "Roots Body Wash",
    sku: "ROOTS-BW-001",
    tagline: "Body wash som respekterar huden — istället för att störa den",
    description:
      "En skonsam kroppstvätt med krämigt lödder som rengör utan att torka ut. Milda tvättämnen och ett Panthenol-derivat lämnar huden len och återfuktad, medan SyriCalm® — av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och stärker hudens naturliga skyddsbarriär. Huden känns ren, mjuk och i balans efter varje dusch.",
    price: "129 kr",
    priceOre: 12900,
    volume: "250 ml",
    image: "/images/body-wash.jpg",
    image2: "/images/body-wash-lifestyle.jpg",
    highlights: ["Sulfatsnålt", "SyriCalm® – lugnar huden", "Panthenol (B5)"],
    ingredients: [
      "Aqua", "Cocamidopropyl Betaine", "Sodium Lauroyl Sarcosinate",
      "Sodium Chloride", "Citric Acid", "Sodium Benzoate",
      "Panthenyl Hydroxypropyl Steardimonium Chloride",
      "PEG-150 Pentaerythrityl Tetrastearate", "Parfum", "Potassium Sorbate",
      "PPG-2 Hydroxyethyl Cocamide", "Panthenol", "Sodium Citrate",
      "Phragmites Communis Extract", "Poria Cocos Extract",
    ],
  },
  [BUNDLE_SLUG]: {
    name: "Roots Komplett paket",
    sku: BUNDLE_SKU,
    tagline: "Hela rutinen — schampo, balsam och kroppstvätt i ett paket",
    description:
      "De tre produkterna är formulerade för att användas tillsammans. Schampot rengör utan att rubba hårbottnens balans, balsamet ger tillbaka fukt och följsamhet, och kroppstvätten tar hand om huden på samma skonsamma sätt. SyriCalm® — den nordiska aktiven av vass och svamp — går igenom alla tre. Som paket kostar de 299 kr istället för 427 kr var för sig.",
    price: "299 kr",
    priceOre: 29900,
    volume: "3 × 250 ml",
    image: "/images/collection-4.jpg",
    image2: "/images/collection-1.jpg",
    highlights: ["Alla tre produkterna", "Spara 128 kr", "SyriCalm® i hela rutinen"],
    contains: [
      { slug: "shampoo", label: "Roots Schampoo — 250 ml" },
      { slug: "conditioner", label: "Roots Conditioner — 250 ml" },
      { slug: "body-wash", label: "Roots Body Wash — 250 ml" },
    ],
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) {
    return { title: "Produkt hittades inte", robots: { index: false } };
  }
  // MASTERPLAN_01 KC7.4 + KC7.5: canonical + per-produkt OG-image så
  // produktdelningar i Slack/iMessage visar rätt produktbild istället
  // för site-default. Inline:ar pageMetadata() här för att slippa
  // import-cykel mellan PRODUCTS-data och seo-helpern.
  return {
    title: product.name,
    description: product.tagline,
    alternates: { canonical: `/produkter/${slug}` },
    openGraph: {
      type: "website",
      url: `/produkter/${slug}`,
      title: product.name,
      description: product.tagline,
      images: [{ url: product.image, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.tagline,
      images: [product.image],
    },
  };
}

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) notFound();

  return (
    <>
      <ProductJsonLd
        name={product.name}
        description={product.tagline}
        sku={product.sku}
        price={product.priceOre}
        image={product.image}
        url={`${process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"}/produkter/${slug}`}
      />

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <Breadcrumbs
            items={[
              { label: "Produkter", href: "/produkter" },
              { label: product.name },
            ]}
          />

          <Link
            href="/produkter"
            className="mt-4 mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Alla produkter
          </Link>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-4">
              <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
              </div>
              <div className="group relative aspect-[3/2] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5">
                <Image
                  src={product.image2}
                  alt={`${product.name} — i användning`}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <Badge variant="secondary" className="mb-3 w-fit">{product.volume}</Badge>
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
              <p className="mt-6 max-w-[50ch] leading-relaxed text-muted-foreground">
                {product.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {product.highlights.map((h) => (
                  <Badge key={h} variant="outline">{h}</Badge>
                ))}
              </div>

              <p className="mt-8 text-3xl font-bold">{product.price}</p>

              <Button size="lg" pulse className="mt-6 w-fit" asChild>
                <Link href="/foreningsliv">Beställ via din förening</Link>
              </Button>

              <Separator className="my-8" />

              {/* Paketet listar sitt innehåll och länkar vidare — tre INCI-listor
                  efter varandra hade bara varit svårlästa. */}
              <Card className="border-border/60 bg-brand-50/40 shadow-none">
                <CardContent className="p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {product.contains ? "Detta ingår" : "Ingredienser (INCI)"}
                  </h2>
                  {product.contains ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {product.contains.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={`/produkter/${item.slug}`}
                            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {product.ingredients?.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      {/* MASTERPLAN_01 KC6.2: respect iOS safe-area så home-indikatorn
          inte täcker köp-knappen på iPhone X+. pb-[max(...)] säkerställer
          minst 0.75rem padding på äldre enheter utan safe-area-inset. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="text-sm text-muted-foreground">{product.price}</p>
          </div>
          <Button size="sm" className="shrink-0" asChild>
            <Link href="/foreningsliv">Beställ via din förening</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
