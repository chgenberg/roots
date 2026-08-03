import type { ReactNode } from "react";
import Link from "next/link";
import { RootsLogo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-50/30">
      <header className="flex h-16 items-center px-6">
        <Link
          href="/"
          aria-label="Roots — startsida"
          className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
        >
          <RootsLogo variant="auto" className="h-7 w-[70px]" />
        </Link>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-6 pb-16 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
