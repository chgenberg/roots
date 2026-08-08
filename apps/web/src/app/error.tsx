"use client";

import { useEffect } from "react";
import { reportWebError } from "@/lib/report-error";
import { errors } from "@/i18n/dictionaries/errors";
import { useLocale } from "@/i18n/locale-context";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  const t = errors[locale];

  useEffect(() => {
    console.error("[ErrorBoundary]", error);
    reportWebError(error, { kind: "render", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">
        {t.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {t.title}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t.body}</p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center rounded-full bg-inverse-surface px-6 py-2.5 text-sm font-medium text-inverse-on-surface transition-colors duration-150 hover:bg-inverse-surface-hover"
        >
          {t.retry}
        </button>
        <a
          href={locale === "en" ? "/en" : "/"}
          className="inline-flex items-center rounded-full border border-border px-6 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-brand-50"
        >
          {t.home}
        </a>
      </div>
    </div>
  );
}
