import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { LocaleLink } from "@/components/locale-link";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

function linkedPrivacyParagraph(text: string, locale: "sv" | "en") {
  const needle = locale === "en" ? "privacy policy" : "integritetspolicy";
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return text;
  const end = idx + needle.length;
  return (
    <>
      {text.slice(0, idx)}
      <LocaleLink
        href="/integritet"
        className="underline hover:text-foreground"
      >
        {text.slice(idx, end)}
      </LocaleLink>
      {text.slice(end)}
    </>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("villkor", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/villkor",
    locale,
  });
}

export default async function VillkorPage() {
  const locale = await getRequestLocale();
  const t = getPage("villkor", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/villkor", locale) },
        ]}
      />
      <WebPageJsonLd
        name={t.title}
        description={t.description}
        url={withLocale("/villkor", locale)}
        locale={locale}
      />
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.updated}</p>

      <div className="mt-10 space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1">
        {t.sections.map((section, idx) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p.slice(0, 40)} className="mt-3">
                {idx === 6 ? linkedPrivacyParagraph(p, locale) : p}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3">
                {section.bullets.map((b) => (
                  <li key={b.text}>{b.text}</li>
                ))}
              </ul>
            )}
            {idx === 9 && (
              <div className="mt-3">
                <LegalIdentityBlock
                  variant="block"
                  showContact
                  className="not-italic leading-relaxed text-muted-foreground"
                />
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
