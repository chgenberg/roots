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

const PRODUCTS: Record<
  string,
  {
    name: string;
    tagline: string;
    description: string;
    price: string;
    volume: string;
    image: string;
    highlights: string[];
    ingredients: string[];
  }
> = {
  shampoo: {
    name: "First Growth",
    tagline: "Schampo som rengör på riktigt — utan att överbehandla",
    description:
      "Ett milt men effektivt schampo som rengör håret utan att torka ut eller störa hårbotten. Löddrar bra, tar bort smuts och fett men lämnar håret mjukt och i balans. Vi har inkluderat björkextrakt — en klassisk nordisk ingrediens som traditionellt används för att stärka hår och stimulera hårbotten.",
    price: "149 kr",
    volume: "250 ml",
    image: "/images/m3.jpg",
    highlights: ["Sulfatfritt", "Björkextrakt", "Panthenol & Niacinamid"],
    ingredients: [
      "Aqua", "Sodium Cocoyl Isethionate", "Cocamidopropyl Betaine",
      "Coco-Glucoside", "Glycerin", "Aloe Barbadensis Leaf Juice",
      "Betula Alba (Birch) Leaf Extract", "Panthenol", "Niacinamide",
      "Glyceryl Oleate", "Guar Hydroxypropyltrimonium Chloride", "Xanthan Gum",
      "Sodium Chloride", "Sodium Benzoate", "Potassium Sorbate",
      "Ethylhexylglycerin", "Sodium Phytate", "Citric Acid", "Parfum",
    ],
  },
  conditioner: {
    name: "Pure Root",
    tagline: "Balsam som ger håret det det faktiskt behöver — inget mer, inget mindre",
    description:
      "Ett närande balsam som gör håret mjukt, följsamt och lätt att reda ut utan att tynga ner. Återfuktar, stärker och ger glans samtidigt som det skyddar håret från slitage. Här har vi adderat havtornsolja — en nordisk superingrediens rik på vitaminer och fettsyror som ger näring och lyster.",
    price: "149 kr",
    volume: "250 ml",
    image: "/images/p5.jpg",
    highlights: ["Silikonfritt", "Havtornsolja", "Sheabutter & Argan"],
    ingredients: [
      "Aqua", "Cetearyl Alcohol", "Behentrimonium Chloride", "Glycerin",
      "Butyrospermum Parkii (Shea) Butter", "Cocos Nucifera Oil",
      "Hippophae Rhamnoides (Sea Buckthorn) Fruit Oil",
      "Aloe Barbadensis Leaf Juice", "Panthenol", "Hydrolyzed Wheat Protein",
      "Argania Spinosa Kernel Oil", "Stearamidopropyl Dimethylamine",
      "Guar Hydroxypropyltrimonium Chloride", "Lactic Acid", "Tocopherol",
      "Sodium Benzoate", "Potassium Sorbate", "Ethylhexylglycerin",
      "Sodium Phytate", "Citric Acid", "Parfum",
    ],
  },
  "body-wash": {
    name: "Soft Rinse",
    tagline: "Body wash som respekterar huden — istället för att störa den",
    description:
      "En skonsam kroppstvätt som rengör huden utan att torka ut. Ger ett mjukt lödder och bevarar hudens naturliga balans så att huden känns återfuktad och fräsch efter dusch. Vi har inkluderat lingonextrakt — rikt på antioxidanter och välkänt i nordisk hudvård för sina skyddande och lugnande egenskaper.",
    price: "129 kr",
    volume: "300 ml",
    image: "/images/p6.jpg",
    highlights: ["Parabenfritt", "Lingonextrakt", "Kamomillextrakt"],
    ingredients: [
      "Aqua", "Cocamidopropyl Betaine", "Coco-Glucoside", "Decyl Glucoside",
      "Glycerin", "Aloe Barbadensis Leaf Juice",
      "Vaccinium Vitis-Idaea (Lingonberry) Fruit Extract",
      "Sodium Lauroyl Sarcosinate", "Sodium Cocoamphoacetate", "Panthenol",
      "Niacinamide", "Chamomilla Recutita Flower Extract", "Glyceryl Oleate",
      "Hydroxypropyl Methylcellulose", "Xanthan Gum", "Sodium Benzoate",
      "Potassium Sorbate", "Ethylhexylglycerin", "Sodium Phytate",
      "Citric Acid", "Parfum",
    ],
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) return { title: "Produkt hittades inte" };
  return { title: product.name, description: product.tagline };
}

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) notFound();

  const priceOre = slug === "body-wash" ? 12900 : 14900;

  return (
    <>
      <ProductJsonLd
        name={product.name}
        description={product.tagline}
        sku={`ROOTS-${slug.toUpperCase().replace("-", "")}-001`}
        price={priceOre}
        image={product.image}
        url={`https://roots.se/produkter/${slug}`}
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
            <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5">
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

              <Card className="border-border/60 bg-brand-50/40 shadow-none">
                <CardContent className="p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ingredienser (INCI)
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {product.ingredients.join(", ")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
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
