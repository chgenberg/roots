import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { pageMetadata } from "@/lib/seo";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("integritet", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/integritet",
    locale,
  });
}

export default async function IntegritetPage() {
  const locale = await getRequestLocale();
  const t = getPage("integritet", locale);
  const homeLabel = getPage("produkter", locale).breadcrumbHome;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <BreadcrumbJsonLd
        items={[
          { name: homeLabel, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/integritet", locale) },
        ]}
      />
      <WebPageJsonLd
        name={t.title}
        description={t.description}
        url={withLocale("/integritet", locale)}
        locale={locale}
      />
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.updated}</p>

      <div className="mt-10 space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {t.sections.map((section, idx) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p.slice(0, 40)} className="mt-3">
                {p}
              </p>
            ))}
            {idx === 0 && (
              <div className="mt-3">
                <LegalIdentityBlock
                  variant="block"
                  showContact
                  className="not-italic leading-relaxed text-muted-foreground"
                />
              </div>
            )}
            {section.bullets && (
              <ul className="mt-3">
                {section.bullets.map((b) => {
                  const label = "label" in b ? b.label : undefined;
                  return (
                    <li key={`${label ?? ""}${b.text}`}>
                      {label ? (
                        <>
                          <strong className="text-foreground">{label}</strong>
                          {" — "}
                          {b.text}
                        </>
                      ) : (
                        b.text
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {section.after?.map((p, afterIdx) => (
              <div key={p.slice(0, 40)}>
                <p className="mt-3">{p}</p>
                {idx === 6 && afterIdx === 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
                    <LegalIdentityBlock
                      variant="block"
                      showContact
                      className="not-italic leading-relaxed text-muted-foreground"
                    />
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
