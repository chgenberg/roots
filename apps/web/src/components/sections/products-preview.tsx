import { SoftImage } from "@/components/soft-image";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { LocaleLink } from "@/components/locale-link";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function ProductsPreview() {
  const locale = await getRequestLocale();
  const { products } = getHome(locale);

  return (
    <section className="py-20 md:py-28" id="produkter">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{products.badge}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">{products.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{products.body}</p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
          {products.items.map((product) => (
            <LocaleLink
              key={product.slug}
              href={`/produkter/${product.slug}`}
              className="group rounded-3xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-brand-50">
                <SoftImage
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{product.name}</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {product.tagline}
              </p>
              <p className="mt-2 text-base font-semibold">{product.price}</p>
            </LocaleLink>
          ))}
        </div>
      </div>
    </section>
  );
}
