import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Leaf, Droplets, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Produkter" };

const PRODUCTS = [
  {
    slug: "shampoo",
    name: "First Growth",
    subtitle: "Schampo — 250 ml",
    tagline: "Ett milt men effektivt schampo som rengör håret utan att torka ut eller störa hårbotten. Med björkextrakt — en klassisk nordisk ingrediens som stärker hår och stimulerar hårbotten.",
    image: "/images/m3.jpg",
    price: "149 kr",
    badge: "Bestseller",
    highlights: ["Sulfatfritt", "Björkextrakt", "Panthenol & Niacinamid"],
  },
  {
    slug: "conditioner",
    name: "Pure Root",
    subtitle: "Balsam — 250 ml",
    tagline: "Ett närande balsam som gör håret mjukt, följsamt och lätt att reda ut utan att tynga ner. Med havtornsolja — en nordisk superingrediens rik på vitaminer och fettsyror.",
    image: "/images/p5.jpg",
    price: "149 kr",
    badge: null,
    highlights: ["Silikonfritt", "Havtornsolja", "Sheabutter & Argan"],
  },
  {
    slug: "body-wash",
    name: "Soft Rinse",
    subtitle: "Body Wash — 300 ml",
    tagline: "En skonsam kroppstvätt som rengör huden utan att torka ut. Med lingonextrakt — rikt på antioxidanter och välkänt i nordisk hudvård för sina skyddande egenskaper.",
    image: "/images/p6.jpg",
    price: "129 kr",
    badge: null,
    highlights: ["Parabenfritt", "Lingonextrakt", "Kamomillextrakt"],
  },
];

const VALUES = [
  { icon: Leaf, label: "100% naturliga ingredienser" },
  { icon: Droplets, label: "Sulfat- och silikonfritt" },
  { icon: Sparkles, label: "Unisex — för alla" },
];

export default function ProdukterPage() {
  return (
    <>
      <section className="bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">Våra produkter</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Tre noggrant formulerade produkter med nordiska ingredienser.
              Utan sulfater, silikoner eller parabener.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            {VALUES.map((v) => (
              <div key={v.label} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm shadow-sm">
                <v.icon className="h-4 w-4 text-muted-foreground" />
                {v.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="space-y-24">
            {PRODUCTS.map((product, idx) => (
              <div
                key={product.slug}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  idx % 2 === 1 ? "lg:[direction:rtl] lg:[&>*]:direction-ltr" : ""
                }`}
              >
                <Link href={`/produkter/${product.slug}`} className="group relative">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
                    {product.badge && (
                      <div className="absolute left-4 top-4">
                        <Badge>{product.badge}</Badge>
                      </div>
                    )}
                  </div>
                </Link>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">{product.subtitle}</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">{product.name}</h2>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">{product.tagline}</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.highlights.map((h) => (
                      <Badge key={h} variant="outline">{h}</Badge>
                    ))}
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <span className="text-2xl font-bold">{product.price}</span>
                    <Button asChild>
                      <Link href={`/produkter/${product.slug}`}>
                        Läs mer
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-brand-50/40 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 text-center md:px-10">
          <Card className="mx-auto inline-flex max-w-md items-center gap-6 border-0 bg-white p-8 shadow-md">
            <CardContent className="p-0">
              <p className="text-3xl font-bold">399 kr</p>
              <p className="mt-1 text-sm text-muted-foreground">Komplett paket — schampo, balsam och body wash</p>
              <Button className="mt-6" asChild>
                <Link href="/foreningsliv">Beställ för din förening</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
