import type { Metadata } from "next";
import { RootsSymbol } from "@/components/brand";
import { LocaleLink } from "@/components/locale-link";
import { getPage } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("notFound", locale);
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: true },
  };
}

export default async function NotFound() {
  const locale = await getRequestLocale();
  const t = getPage("notFound", locale);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
      <RootsSymbol variant="dark" className="h-20 w-20" priority />
      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-brand-700">
        {t.code}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {t.heading}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LocaleLink
          href="/"
          className="inline-flex items-center rounded-full bg-inverse-surface px-6 py-2.5 text-sm font-medium text-inverse-on-surface transition-colors duration-150 hover:bg-inverse-surface-hover"
        >
          {t.homeCta}
        </LocaleLink>
        <LocaleLink
          href="/hjalp"
          className="inline-flex items-center rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
        >
          {t.helpCta}
        </LocaleLink>
      </div>
    </main>
  );
}
