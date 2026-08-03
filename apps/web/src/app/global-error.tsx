"use client";

import { useEffect } from "react";
import { reportWebError } from "@/lib/report-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    reportWebError(error, { kind: "render", digest: error.digest });
  }, [error]);

  return (
    <html lang="sv">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-400">
          Något gick fel
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Ett oväntat fel uppstod
        </h1>
        <p className="mt-3 max-w-md text-neutral-500">
          Vi beklagar besväret. Försök att ladda om sidan eller gå tillbaka till
          startsidan.
        </p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Försök igen
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-full border border-neutral-200 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-50"
          >
            Till startsidan
          </a>
        </div>
      </body>
    </html>
  );
}
