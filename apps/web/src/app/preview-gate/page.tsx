import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { RootsLogo } from "@/components/brand";
import { PreviewGateForm } from "./preview-gate-form";

export const metadata: Metadata = {
  title: "Vi lanserar inom kort",
  description:
    "Roots lanserar inom kort. Anmäl dig så hör vi av oss först av alla, eller ange lösenord för förhandsvisning.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// Standalone page — deliberately outside the marketing layout (no header,
// no footer) so the gate really blocks the site instead of framing it.
// Server-rendered: the middleware rewrites *every* un-unlocked request
// here, so the initial HTML stays lean and paints fast.
//
// The hero photograph doubles as the backdrop. Using the same image the
// visitor meets on the front page makes the unlock feel like a curtain
// lifting rather than a jump between two unrelated designs.
export default function PreviewGatePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:py-12">
      <Image
        src="/images/collection-2.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-105 object-cover blur-[2px]"
      />
      {/* Scrim: carries the card's contrast so the white surface reads as
          floating above the photo rather than pasted onto it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-brand-900/55 via-brand-900/45 to-brand-900/70"
      />

      <div className="animate-slide-up relative w-full max-w-[26rem]">
        <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-dialog)] sm:p-9">
          <div className="flex justify-center">
            <RootsLogo
              variant="black"
              className="h-10 w-[100px] sm:h-11 sm:w-[110px]"
              priority
            />
          </div>

          <div className="mt-7 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Snart i hamn
            </p>
            <h1 className="mt-2.5 text-[1.6rem] font-bold leading-[1.15] tracking-tight sm:text-3xl">
              Vi lanserar
              <br />
              inom kort
            </h1>
            <p className="mx-auto mt-3.5 max-w-[19rem] text-sm leading-relaxed text-muted-foreground">
              Lämna din e-post och bli först av alla att veta när Roots öppnar
              för föreningar.
            </p>
          </div>

          <div className="mt-7">
            <Suspense fallback={null}>
              <PreviewGateForm />
            </Suspense>
          </div>
        </div>

        {/* Sits directly on the photograph, whose brightness varies, so it
            carries its own shadow rather than relying on the scrim. */}
        <p className="mt-5 text-center text-xs text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0/45%)]">
          © {new Date().getFullYear()} Roots Nordic AB
        </p>
      </div>
    </div>
  );
}
