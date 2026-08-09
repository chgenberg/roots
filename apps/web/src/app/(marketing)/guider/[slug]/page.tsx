import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideRichText } from "@/components/guide-rich-text";
import { LocaleLink } from "@/components/locale-link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import {
  GUIDE_SLUGS,
  getGuide,
  getGuideCategories,
} from "@/content/guides";
import { getPage } from "@/i18n/get-dictionary";
import { withLocale } from "@/i18n/paths";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale();
  const chrome = getPage("guiderArticle", locale);
  const { slug } = await params;
  const guide = getGuide(slug, locale);
  if (!guide) {
    return pageMetadata({
      title: chrome.notFoundTitle,
      description: chrome.notFoundDescription,
      path: `/guider/${slug}`,
      locale,
      noindex: true,
    });
  }
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guider/${guide.slug}`,
    locale,
    ogType: "article",
    ogImage: guide.heroImage,
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt,
    authors: ["Ourroots AB"],
  });
}

export default async function GuideArticlePage({ params }: PageProps) {
  const locale = await getRequestLocale();
  const chrome = getPage("guiderArticle", locale);
  const categories = getGuideCategories(locale);
  const { slug } = await params;
  const guide = getGuide(slug, locale);
  if (!guide) notFound();

  const category = categories[guide.category];
  const related = (guide.relatedSlugs ?? [])
    .map((s) => getGuide(s, locale))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const dateLocale = locale === "en" ? "en-GB" : "sv-SE";
  const updatedLabel = new Date(guide.updatedAt).toLocaleDateString(dateLocale, {
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
              { label: chrome.breadcrumbHome, href: "/" },
              { label: chrome.breadcrumbGuides, href: "/guider" },
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
            {chrome.updatedPrefix} {updatedLabel}
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
                    <GuideRichText text={p} locale={locale} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {guide.faqs && guide.faqs.length > 0 ? (
          <section className="mt-14 border-t border-border pt-12">
            <h2 className="text-xl font-semibold tracking-tight">
              {chrome.faqTitle}
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
              {chrome.nextStepTitle}
            </p>
            <p className="mt-2 text-muted-foreground">{chrome.nextStepBody}</p>
            <Button className="mt-5" asChild>
              <LocaleLink href={guide.cta.href}>
                {guide.cta.label}
                <ArrowRight className="ml-1 h-4 w-4" />
              </LocaleLink>
            </Button>
          </div>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-14 border-t border-border pt-12">
            <h2 className="text-xl font-semibold tracking-tight">
              {chrome.relatedTitle}
            </h2>
            <ul className="mt-5 space-y-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <LocaleLink
                    href={`/guider/${r.slug}`}
                    className="group inline-flex items-start gap-2 text-foreground transition-colors hover:text-brand-700"
                  >
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-500 transition-transform group-hover:translate-x-0.5" />
                    <span>
                      <span className="font-medium">{r.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {categories[r.category].label}
                      </span>
                    </span>
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-12 text-sm text-muted-foreground">
          <LocaleLink
            href="/guider"
            className="font-medium text-foreground underline decoration-brand-300 underline-offset-2 hover:decoration-brand-500"
          >
            {chrome.allGuides}
          </LocaleLink>
        </p>
      </div>

      <ArticleJsonLd
        headline={guide.title}
        description={guide.description}
        url={withLocale(`/guider/${guide.slug}`, locale)}
        datePublished={guide.publishedAt}
        dateModified={guide.updatedAt}
        image={guide.heroImage}
        locale={locale}
      />
      <BreadcrumbJsonLd
        items={[
          { name: chrome.breadcrumbHome, url: withLocale("/", locale) },
          {
            name: chrome.breadcrumbGuides,
            url: withLocale("/guider", locale),
          },
          {
            name: guide.title,
            url: withLocale(`/guider/${guide.slug}`, locale),
          },
        ]}
      />
      {guide.faqs && guide.faqs.length > 0 ? (
        <FaqJsonLd faqs={guide.faqs} />
      ) : null}
    </article>
  );
}
