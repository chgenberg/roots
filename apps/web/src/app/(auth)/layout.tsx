import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-50/30">
      <header className="flex h-16 items-center px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          Roots
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
