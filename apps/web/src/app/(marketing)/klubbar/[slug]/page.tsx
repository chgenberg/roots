import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { ClubMorphLink } from "@/components/club-morph-link";
import { LocaleLink } from "@/components/locale-link";
import { Button } from "@/components/ui/button";
import { connectedClubs, getClub } from "@/content/clubs";
import { getHome, getPage } from "@/i18n/get-dictionary";
import { withLocale } from "@/i18n/paths";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return connectedClubs.map((club) => ({ slug: club.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale();
  const { slug } = await params;
  const club = getClub(slug);
  if (!club) {
    return pageMetadata({ title: "Roots", description: "", path: `/klubbar/${slug}`, locale, noindex: true });
  }
  const copy = club.copy[locale];
  return pageMetadata({
    title: `${club.name} – ${copy.sport}`,
    description: copy.summary,
    path: `/klubbar/${club.slug}`,
    locale,
  });
}

export default async function ClubPage({ params }: PageProps) {
  const locale = await getRequestLocale();
  const { slug } = await params;
  const club = getClub(slug);
  if (!club) notFound();

  const copy = club.copy[locale];
  const t = getHome(locale).clubs;
  const homeLabel = getPage("produkter", locale).breadcrumbHome;
  const others = connectedClubs.filter((c) => c.slug !== club.slug);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: club.name, url: withLocale(`/klubbar/${club.slug}`, locale) },
        ]}
      />

      <section className="bg-[linear-gradient(180deg,#F7F3EA_0%,#FBF9F5_60%,transparent_100%)] pb-16 pt-10 md:pb-24">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <Breadcrumbs
            items={[
              { label: homeLabel, href: "/" },
              { label: t.breadcrumb, href: "/#klubbar-titel" },
              { label: club.name },
            ]}
          />

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-14">
            <div>
              <p className="text-sm font-semibold text-brand-700">{copy.sport}</p>
              <h1 className="mt-2 text-4xl tracking-tight md:text-5xl">{club.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{club.town}</p>
              <p className="mt-6 text-pretty text-xl leading-relaxed">{copy.summary}</p>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                {copy.body.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <a href={club.website} target="_blank" rel="noopener noreferrer">
                    {t.visitSite}
                    <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">{t.sourceNote}</p>
            </div>

            <aside className="space-y-5">
              <div className="mx-auto flex aspect-square max-w-[260px] items-center justify-center rounded-3xl bg-white p-10 md:max-w-none shadow-[0_1px_2px_rgba(94,83,65,0.06),0_12px_32px_-14px_rgba(94,83,65,0.25)] ring-1 ring-[#E6DED2]">
                <Image
                  key={club.slug}
                  data-club-logo-target={club.slug}
                  style={{ viewTransitionName: "club-logo" }}
                  src={club.logo}
                  alt={club.name}
                  width={club.width}
                  height={club.height}
                  priority
                  sizes="240px"
                  className="h-auto max-h-full w-auto max-w-full object-contain"
                />
              </div>
              <div className="rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] p-6">
                <h2 className="text-base font-semibold">{t.factsTitle}</h2>
                <ul className="mt-3 space-y-2.5">
                  {copy.facts.map((fact) => (
                    <li key={fact} className="flex gap-2.5 text-sm leading-snug">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-t border-brand-200/70 py-16 md:py-20">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <h2 className="text-2xl tracking-tight">{t.otherTitle}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {others.map((other) => (
              <li key={other.slug}>
                <ClubMorphLink
                  slug={other.slug}
                  className="group flex h-full flex-col items-center rounded-2xl bg-white p-5 text-center ring-1 ring-[#E6DED2] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_rgba(94,83,65,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-16 w-full items-center justify-center">
                    <Image
                      src={other.logo}
                      alt=""
                      width={other.width}
                      height={other.height}
                      sizes="120px"
                      data-morph-logo
                      className="h-auto max-h-16 w-auto max-w-[120px] object-contain"
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-tight text-[#5E5341]">{other.name}</p>
                  <p className="mt-1 text-xs text-[#7F715B]">{other.copy[locale].sport}</p>
                </ClubMorphLink>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl tracking-tight">{t.ctaTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-lg text-muted-foreground">{t.ctaBody}</p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild>
                <LocaleLink href="/intresseanmalan">
                  {t.nextCta}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </LocaleLink>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
