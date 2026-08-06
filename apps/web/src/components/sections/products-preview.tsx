import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";
import { BUNDLE_SLUG } from "@/lib/product-catalog";

const PRODUCTS = [
  {
    slug: "shampoo",
    name: "Roots Schampoo",
    tagline: "Rengör på riktigt — SyriCalm® lugnar hårbotten",
    image: "/images/schampoo.jpg",
    price: "149 kr",
    badge: "Schampo",
  },
  {
    slug: "conditioner",
    name: "Roots Conditioner",
    tagline: "Mjukt, följsamt hår — Pro-Vitamin B5 & antioxidanter",
    image: "/images/conditioner.jpg",
    price: "149 kr",
    badge: "Balsam",
  },
  {
    slug: "body-wash",
    name: "Roots Body Wash",
    tagline: "Respekterar huden — SyriCalm® lugnar och stärker",
    image: "/images/body-wash.jpg",
    price: "129 kr",
    badge: "Body Wash",
  },
];

export function ProductsPreview() {
  return (
    <section className="py-10 md:py-14" id="produkter">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">Sortiment</Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Tre produkter. Inget mer.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Vi tror på enkelhet. Varje produkt är noggrant formulerad med
            forskningsförankrade aktiver — för hela familjen.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PRODUCTS.map((product) => (
            <Link key={product.slug} href={`/produkter/${product.slug}`} className="group">
              <Card className="overflow-hidden border-0 bg-brand-50/50 shadow-none transition-all duration-500 hover:bg-card hover:shadow-[var(--shadow-elevated)]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {product.badge && (
                    <div className="absolute left-4 top-4">
                      <Badge variant="default">{product.badge}</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {product.tagline}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <p className="mt-3 text-lg font-semibold">{product.price}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Paketet får inget eget kort i rutnätet — tre kolumner är layouten här.
            Istället leder raden vidare till paketsidan. */}
        <div className="mt-12 text-center">
          <Link
            href={`/produkter/${BUNDLE_SLUG}`}
            className="group inline-flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 text-card-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-50">
              <Image
                src="/images/collection-4.jpg"
                alt="Roots Komplett paket"
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">399 kr</p>
              <p className="text-sm text-muted-foreground">
                Komplett paket — alla tre
              </p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </div>
      </div>
    </section>
  );
}
