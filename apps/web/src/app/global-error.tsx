"use client";

import { useEffect } from "react";
import { reportWebError } from "@/lib/report-error";

function detectLocale(): "sv" | "en" {
  if (typeof window === "undefined") return "sv";
  return window.location.pathname.split("/").filter(Boolean)[0] === "en"
    ? "en"
    : "sv";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = detectLocale();
  const en = locale === "en";

  useEffect(() => {
    console.error("[GlobalError]", error);
    reportWebError(error, { kind: "render", digest: error.digest });
  }, [error]);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-400">
          {en ? "Something went wrong" : "Något gick fel"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {en ? "An unexpected error occurred" : "Ett oväntat fel uppstod"}
        </h1>
        <p className="mt-3 max-w-md text-neutral-500">
          {en
            ? "Sorry about that. Please try reloading the page or go back to the home page."
            : "Vi beklagar besväret. Försök att ladda om sidan eller gå tillbaka till startsidan."}
        </p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            {en ? "Try again" : "Försök igen"}
          </button>
          <a
            href={en ? "/en" : "/"}
            className="inline-flex items-center rounded-full border border-neutral-200 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-50"
          >
            {en ? "Back to home" : "Till startsidan"}
          </a>
        </div>
      </body>
    </html>
  );
}
