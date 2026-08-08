import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideRichText } from "@/components/guide-rich-text";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import {
  GUIDE_CATEGORIES,
  GUIDE_SLUGS,
  getGuide,
  guides,
} from "@/content/guides";
import { ArrowRight } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return pageMetadata({
      title: "Guiden hittades inte",
      description: "Guiden finns inte.",
      path: `/guider/${slug}`,
      noindex: true,
    });
  }
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guider/${guide.slug}`,
    ogType: "article",
    ogImage: guide.heroImage,
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt,
    authors: ["Roots Nordic AB"],
  });
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const category = GUIDE_CATEGORIES[guide.category];
  const related = (guide.relatedSlugs ?? [])
    .map((s) => guides.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const updatedLabel = new Date(guide.updatedAt).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="bg-brand-50/15">
      <header className="border-b border-border/60 bg-brand-50/40">
        <div className="mx-auto max-w-3xl px-6 py-12 md:px-10 md:py-16">
          <Breadcrumbs
            items={[
              { label: "Hem", href: "/" },
              { label: "Guider", href: "/guider" },
              { label: guide.title },
            ]}
          />
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-600">
            {category.label}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {guide.title}
          </h1>
          <p className="lead mt-4 text-lg leading-relaxed text-muted-foreground">
            {guide.description}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Uppdaterad {updatedLabel}
          </p>
        </div>
      </header>

      {guide.heroImage ? (
        <div className="mx-auto max-w-3xl px-6 pt-10 md:px-10">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
            <Image
              src={guide.heroImage}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10 md:py-16">
        <div className="space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground">
          {guide.sections.map((section, i) => (
            <section key={i}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              <div className={section.heading ? "mt-3 space-y-3" : "space-y-3"}>
                {section.paragraphs.map((p, j) => (
                  <p key={j}>
                    <GuideRichText text={p} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {guide.faqs && guide.faqs.length > 0 ? (
          <section className="mt-14 border-t border-border pt-12">
            <h2 className="text-xl font-semibold tracking-tight">
              Vanliga frågor
            </h2>
            <dl className="mt-6 space-y-6">
              {guide.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-semibold text-foreground">
                    {faq.question}
                  </dt>
                  <dd className="mt-2 text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {guide.cta ? (
          <div className="mt-14 rounded-2xl bg-brand-50/70 px-6 py-8 md:px-8">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Nästa steg
            </p>
            <p className="mt-2 text-muted-foreground">
              Vill ni ta det vidare med er förening eller förstå produkterna
              bättre? Vi hjälper er gärna.
            </p>
            <Button className="mt-5" asChild>
              <Link href={guide.cta.href}>
                {guide.cta.label}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-14 border-t border-border pt-12">
            <h2 className="text-xl font-semibold tracking-tight">
              Relaterade guider
            </h2>
            <ul className="mt-5 space-y-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/guider/${r.slug}`}
                    className="group inline-flex items-start gap-2 text-foreground transition-colors hover:text-brand-700"
                  >
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-500 transition-transform group-hover:translate-x-0.5" />
                    <span>
                      <span className="font-medium">{r.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {GUIDE_CATEGORIES[r.category].label}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-12 text-sm text-muted-foreground">
          <Link
            href="/guider"
            className="font-medium text-foreground underline decoration-brand-300 underline-offset-2 hover:decoration-brand-500"
          >
            ← Alla guider
          </Link>
        </p>
      </div>

      <ArticleJsonLd
        headline={guide.title}
        description={guide.description}
        url={`/guider/${guide.slug}`}
        datePublished={guide.publishedAt}
        dateModified={guide.updatedAt}
        image={guide.heroImage}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Guider", url: "/guider" },
          { name: guide.title, url: `/guider/${guide.slug}` },
        ]}
      />
      {guide.faqs && guide.faqs.length > 0 ? (
        <FaqJsonLd faqs={guide.faqs} />
      ) : null}
    </article>
  );
}
