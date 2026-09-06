import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LocaleLink } from "@/components/locale-link";
import {
  BreadcrumbJsonLd,
  ItemListJsonLd,
  WebPageJsonLd,
} from "@/components/json-ld";
import { getGuides } from "@/content/guides";
import type { Guide } from "@/content/guides";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

const CATEGORY_ORDER: Guide["category"][] = [
  "forening",
  "sport",
  "ingrediens",
  "harvard",
];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getPage("guiderIndex", locale);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/guider",
    locale,
  });
}

export default async function GuiderIndexPage() {
  const locale = await getRequestLocale();
  const copy = getPage("guiderIndex", locale);
  const guides = getGuides(locale);

  function byCategory(category: Guide["category"]) {
    return guides.filter((g) => g.category === category);
  }

  return (
    <div className="bg-brand-50/20">
      <BreadcrumbJsonLd
        items={[
          { name: copy.breadcrumbHome, url: "/" },
          { name: copy.title, url: "/guider" },
        ]}
      />
      <WebPageJsonLd
        type="CollectionPage"
        name={copy.title}
        description={copy.description}
        url="/guider"
        locale={locale}
      />
      <ItemListJsonLd
        name={copy.itemListName}
        items={guides.map((g) => ({
          name: g.title,
          url: `/guider/${g.slug}`,
        }))}
      />
      <section className="border-b border-border/60 bg-brand-50/40">
        <div className="mx-auto max-w-3xl px-6 py-14 md:px-10 md:py-20">
          <Breadcrumbs
            items={[
              { label: copy.breadcrumbHome, href: "/" },
              { label: copy.heroTitle },
            ]}
          />
          <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
            {copy.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {copy.heroBody}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-16 px-6 py-14 md:px-10 md:py-20">
        {CATEGORY_ORDER.map((category) => {
          const items = byCategory(category);
          if (!items.length) return null;
          const meta = copy.categories[category];
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
                    <LocaleLink
                      href={`/guider/${guide.slug}`}
                      className="group flex gap-4 rounded-2xl border border-transparent bg-background/80 p-3 transition-colors hover:border-brand-200/80 hover:bg-brand-50/50 sm:p-4"
                    >
                      {guide.heroImage ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-28">
                          <Image
                            src={guide.heroImage}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            sizes="(max-width: 640px) 64px, 112px"
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
                          {copy.readGuide}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </LocaleLink>
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
