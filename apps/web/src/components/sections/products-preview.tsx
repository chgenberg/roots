import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { BUNDLE_SLUG } from "@/lib/product-catalog";
import { LocaleLink } from "@/components/locale-link";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function ProductsPreview() {
  const locale = await getRequestLocale();
  const { products } = getHome(locale);

  return (
    <section className="py-10 md:py-14" id="produkter">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{products.badge}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">{products.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{products.body}</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {products.items.map((product) => (
            <LocaleLink
              key={product.slug}
              href={`/produkter/${product.slug}`}
              className="group"
            >
              <Card className="overflow-hidden border-0 bg-brand-50/50 shadow-none transition-all duration-500 hover:bg-card hover:shadow-[var(--shadow-elevated)]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
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
            </LocaleLink>
          ))}
        </div>

        <div className="mt-12 text-center">
          <LocaleLink
            href={`/produkter/${BUNDLE_SLUG}`}
            className="group inline-flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 text-card-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-50">
              <Image
                src="/images/sport-package.jpg"
                alt={products.bundle.alt}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">{products.bundle.price}</p>
              <p className="text-sm text-muted-foreground">
                {products.bundle.label}
              </p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}
