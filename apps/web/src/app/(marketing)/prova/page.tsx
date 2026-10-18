import type { Metadata } from "next";
import { DemoShop, type DemoProduct } from "@/components/demo-shop/demo-shop";
import { clubGenitive, demo } from "@/i18n/dictionaries/demo";
import { tFill } from "@/i18n/format";
import { getProduct, type ProductSlug } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { productImage } from "@/lib/product-catalog";
import { pageMetadata } from "@/lib/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PRODUCT_SLUGS: ProductSlug[] = ["shampoo", "conditioner", "body-wash", "paket"];

function param(sp: Record<string, string | string[] | undefined>, key: string, max: number) {
  const raw = sp[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return value.slice(0, max);
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = demo[locale];
  const sp = await searchParams;
  const club = param(sp, "forening", 60);
  if (club.length < 2) {
    return pageMetadata({ title: t.metaTitle, description: t.metaDescription, path: "/prova", locale });
  }
  const og = new URLSearchParams({ forening: club, locale });
  const team = param(sp, "lag", 40);
  if (team) og.set("lag", team);
  const site = param(sp, "webb", 120);
  if (site) og.set("webb", site);
  const colour = param(sp, "farg", 6);
  if (/^[0-9a-f]{6}$/i.test(colour)) og.set("farg", colour);
  return pageMetadata({
    title: tFill(t.metaTitleFor, { clubGen: clubGenitive(club, locale) }),
    description: t.metaDescription,
    path: "/prova",
    locale,
    ogImage: `/og/demo?${og.toString()}`,
    noindex: true,
  });
}

export default async function ProvaPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getRequestLocale();
  const t = demo[locale];
  const sp = await searchParams;
  const club = param(sp, "forening", 60);
  const team = param(sp, "lag", 40);
  const goal = Number(param(sp, "mal", 7)) || undefined;
  const website = param(sp, "webb", 120);
  const colour = param(sp, "farg", 6);

  const products: DemoProduct[] = PRODUCT_SLUGS.map((slug) => {
    const copy = getProduct(slug, locale);
    return {
      slug,
      name: copy.name,
      priceSek: copy.priceSek,
      image: productImage(slug),
    };
  });

  return (
    <section className="bg-[linear-gradient(180deg,#F7F3EA_0%,#FBF9F5_45%,transparent_100%)] pb-20 pt-12 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <p className="text-sm font-semibold text-brand-700">{t.eyebrow}</p>
          <h1 className="mt-2 text-4xl tracking-tight md:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted-foreground">{t.lead}</p>
        </div>
        <DemoShop
          products={products}
          initialClub={club}
          initialTeam={team}
          initialGoalKr={goal}
          initialWebsite={website}
          initialColour={/^[0-9a-f]{6}$/i.test(colour) ? `#${colour.toUpperCase()}` : undefined}
          shared={club.length >= 2}
        />
      </div>
    </section>
  );
}
