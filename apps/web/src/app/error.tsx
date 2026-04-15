"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">
        Något gick fel
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Ett oväntat fel uppstod
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Vi beklagar besväret. Försök att ladda om sidan eller gå tillbaka till
        startsidan.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center rounded-full bg-inverse-surface px-6 py-2.5 text-sm font-medium text-inverse-on-surface transition-colors duration-150 hover:bg-inverse-surface-hover"
        >
          Försök igen
        </button>
        <a
          href="/"
          className="inline-flex items-center rounded-full border border-border px-6 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-brand-50"
        >
          Till startsidan
        </a>
      </div>
    </div>
  );
}
