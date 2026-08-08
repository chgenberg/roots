import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  BreadcrumbJsonLd,
  ItemListJsonLd,
  WebPageJsonLd,
} from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { guides, GUIDE_CATEGORIES } from "@/content/guides";
import type { Guide } from "@/content/guides";
import { ArrowRight } from "lucide-react";

const PAGE_TITLE = "Guider";
const PAGE_DESCRIPTION =
  "Guider om föreningsförsäljning, sportlag, ingredienser och hårvård från Roots — premium, föreningsnära och på svenska.";

export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/guider",
});

const CATEGORY_ORDER: Guide["category"][] = [
  "forening",
  "sport",
  "ingrediens",
  "harvard",
];

function byCategory(category: Guide["category"]) {
  return guides.filter((g) => g.category === category);
}

export default function GuiderIndexPage() {
  return (
    <div className="bg-brand-50/20">
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Guider", url: "/guider" },
        ]}
      />
      <WebPageJsonLd
        type="CollectionPage"
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/guider"
      />
      <ItemListJsonLd
        name="Roots guider"
        items={guides.map((g) => ({
          name: g.title,
          url: `/guider/${g.slug}`,
        }))}
      />
      <section className="border-b border-border/60 bg-brand-50/40">
        <div className="mx-auto max-w-3xl px-6 py-14 md:px-10 md:py-20">
          <Breadcrumbs
            items={[{ label: "Hem", href: "/" }, { label: "Guider" }]}
          />
          <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
            Guider
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Kunskap för föreningar, lag och alla som vill förstå Roots
            hårvård — utan fluff och utan medicinska löften.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-16 px-6 py-14 md:px-10 md:py-20">
        {CATEGORY_ORDER.map((category) => {
          const items = byCategory(category);
          if (!items.length) return null;
          const meta = GUIDE_CATEGORIES[category];
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2
                id={`cat-${category}`}
                className="text-xl font-semibold tracking-tight"
              >
                {meta.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {meta.description}
              </p>
              <ul className="mt-6 space-y-3">
                {items.map((guide) => (
                  <li key={guide.slug}>
                    <Link
                      href={`/guider/${guide.slug}`}
                      className="group flex gap-4 rounded-2xl border border-transparent bg-background/80 p-3 transition-colors hover:border-brand-200/80 hover:bg-brand-50/50 sm:p-4"
                    >
                      {guide.heroImage ? (
                        <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl sm:block">
                          <Image
                            src={guide.heroImage}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            sizes="112px"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tracking-tight text-foreground group-hover:text-brand-700">
                          {guide.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {guide.description}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                          Läs guiden
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
