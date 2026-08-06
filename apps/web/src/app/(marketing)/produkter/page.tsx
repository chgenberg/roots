import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Leaf, Droplets, Sparkles } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { BUNDLE_SLUG } from "@/lib/product-catalog";

export const metadata = pageMetadata({
  title: "Produkter",
  description:
    "Tre noggrant formulerade nordiska produkter med SyriCalm® och Pro-Vitamin B5 — var för sig eller som komplett paket. Sulfatsnålt, silikon- och parabenfritt.",
  path: "/produkter",
});

const PRODUCTS = [
  {
    slug: "shampoo",
    name: "Roots Schampoo",
    subtitle: "Schampo — 250 ml",
    tagline: "Ett milt men effektivt schampo som rengör utan att torka ut. SyriCalm® lugnar hårbotten och Polyquaternium reder ut — håret känns rent, lätt och i balans.",
    image: "/images/schampoo.jpg",
    price: "149 kr",
    badge: "Bestseller",
    highlights: ["Sulfatsnålt", "SyriCalm®", "Reder ut & glans"],
  },
  {
    slug: "conditioner",
    name: "Roots Conditioner",
    subtitle: "Balsam — 250 ml",
    tagline: "Ett närande balsam som gör håret mjukt och följsamt utan att tynga. Pro-Vitamin B5 och antioxidanter ger fukt, lyster och skydd — SyriCalm® lugnar hårbotten.",
    image: "/images/conditioner.jpg",
    price: "149 kr",
    badge: null,
    highlights: ["SyriCalm® & Panthenol", "E-vitamin", "Närande utan att tynga"],
  },
  {
    slug: "body-wash",
    name: "Roots Body Wash",
    subtitle: "Body Wash — 250 ml",
    tagline: "En skonsam kroppstvätt som rengör utan att torka ut. Milda tvättämnen och SyriCalm® lämnar huden len, återfuktad och i balans.",
    image: "/images/body-wash.jpg",
    price: "129 kr",
    badge: null,
    highlights: ["Sulfatsnålt", "SyriCalm®", "Panthenol (B5)"],
  },
  {
    slug: BUNDLE_SLUG,
    name: "Roots Komplett paket",
    subtitle: "Paket — schampo, balsam & body wash",
    tagline:
      "Hela rutinen i ett paket. Samma formuleringar som var för sig, till ett lägre pris — och det som de flesta väljer när de handlar via sin förening.",
    image: "/images/collection-4.jpg",
    price: "399 kr",
    badge: "Spara 28 kr",
    highlights: ["Alla tre produkterna", "3 × 250 ml", "Lägsta pris per flaska"],
  },
];

const VALUES = [
  { icon: Leaf, label: "Forskningsförankrade aktiver" },
  { icon: Droplets, label: "Sulfatsnålt & silikonfritt" },
  { icon: Sparkles, label: "Unisex — för alla" },
];

export default function ProdukterPage() {
  return (
    <>
      <section className="bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-[length:var(--font-size-hero)] font-bold tracking-tight">Våra produkter</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Tre noggrant formulerade nordiska produkter med forskningsförankrade
              aktiver — var för sig eller som komplett paket. Sulfatsnålt,
              silikon- och parabenfritt.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            {VALUES.map((v) => (
              <div key={v.label} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-sm">
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
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                {/* Varannan rad har bilden till höger. Det görs med `order` och
                    inte med `direction: rtl` — rtl är textriktning, och bidi
                    kastade om prisraden så "149 kr" renderades som "kr 149". */}
                <Link
                  href={`/produkter/${product.slug}`}
                  className={`group relative ${idx % 2 === 1 ? "lg:order-2" : ""}`}
                >
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

                <div className={idx % 2 === 1 ? "lg:order-1" : ""}>
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
          <Card className="mx-auto inline-flex max-w-md items-center gap-6 border-0 p-8 shadow-md">
            {/* Priset står på paketkortet ovan — här är det bara vägen vidare,
                så de två inte kan börja visa olika belopp. */}
            <CardContent className="p-0">
              <p className="text-3xl font-bold">Beställ via din förening</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Roots säljs genom föreningar och klubbar — en del av varje köp går
                direkt till laget.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/foreningsliv">Så gör din förening</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
