import type { Metadata } from "next";
import { Suspense } from "react";
import { RootsLogo, RootsSymbol } from "@/components/brand";
import { PreviewGateForm } from "./preview-gate-form";

export const metadata: Metadata = {
  title: "Förhandsvisning",
  description: "Roots är snart i hamn. Ange lösenord för förhandsvisning eller anmäl dig till lanseringen.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// Standalone page — does not use the marketing layout (no header/footer)
// so the gate truly blocks the site. Renders on the server because the
// middleware rewrites *every* request here when the gate cookie is
// missing; we keep the initial HTML lean so first-paint is sub-200ms.
export default function PreviewGatePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-brand-50/40 px-4 py-12">
      {/* Soft brand symbol behind the card. Provides a hint of identity
          without competing with the form copy. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <RootsSymbol variant="dark" className="h-[480px] w-[480px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <RootsLogo variant="black" className="h-10 w-[100px]" priority />
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-elevated)]">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Snart är vi i hamn
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sajten är just nu i förhandsvisning. Ange lösenord för att fortsätta,
              eller anmäl dig så hör vi av oss när vi lanserar.
            </p>
          </div>

          <Suspense fallback={null}>
            <PreviewGateForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Roots Nordic AB
        </p>
      </div>
    </div>
  );
}
