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
    // overflow-hidden so the oversized background symbol can't push
    // a 375px-wide phone into horizontal scroll.
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-50/40 px-4 py-10 sm:py-12">
      {/* Soft brand symbol behind the card. Provides a hint of
          identity without competing with the form copy. Sized
          responsively: ~70vw on the smallest phones (keeps it
          contained), capped at 480px on desktop so it doesn't
          overwhelm the card. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <RootsSymbol
          variant="dark"
          className="h-[260px] w-[260px] sm:h-[360px] sm:w-[360px] md:h-[480px] md:w-[480px]"
        />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center sm:mb-8">
          <RootsLogo
            variant="black"
            className="h-9 w-[90px] sm:h-10 sm:w-[100px]"
            priority
          />
        </div>

        {/* Smaller padding on mobile so the card doesn't crowd the
            edges of the viewport at 375px wide. */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
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
