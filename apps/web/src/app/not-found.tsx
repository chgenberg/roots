import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">
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
