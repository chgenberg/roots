import Link from "next/link";
import { RootsSymbol } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
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
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-full bg-inverse-surface px-6 py-2.5 text-sm font-medium text-inverse-on-surface transition-colors duration-150 hover:bg-inverse-surface-hover"
      >
        Till startsidan
      </Link>
    </div>
  );
}
