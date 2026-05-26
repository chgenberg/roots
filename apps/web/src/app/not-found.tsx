import Link from "next/link";
import type { Metadata } from "next";
import { RootsSymbol } from "@/components/brand";

// P3.74 (audit 2026-05-26): tidigare saknade 404-sidan metadata och
// skip-target → tab-namn blev defaulttiteln och keyboard-skip-links
// tappade fästpunkt. Lägg båda + noindex så crawlers inte indexerar
// 404:or som canonical pages.
export const metadata: Metadata = {
  title: "Sidan hittades inte",
  description: "Sidan du letar efter finns inte eller har flyttats.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
      {/* Sprint E14: branded 404 page — the symbol carries the brand
          identity without needing extra copy or illustration. Sand
          backdrop on the symbol naturally pairs with the page bg. */}
      <RootsSymbol variant="dark" className="h-20 w-20" priority />
      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-brand-700">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Sidan kunde inte hittas
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Sidan du letar efter finns inte eller har flyttats. Kontrollera adressen
        eller gå tillbaka till startsidan.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-inverse-surface px-6 py-2.5 text-sm font-medium text-inverse-on-surface transition-colors duration-150 hover:bg-inverse-surface-hover"
        >
          Till startsidan
        </Link>
        <Link
          href="/hjalp"
          className="inline-flex items-center rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
        >
          Få hjälp
        </Link>
      </div>
    </main>
  );
}
