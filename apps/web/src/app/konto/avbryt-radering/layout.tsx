import type { Metadata } from "next";

// P3.75 (audit 2026-05-26): page.tsx är "use client" så vi kan inte
// sätta metadata där. Layout-fil ger tab-titel + noindex (sidan är
// GDPR-kritisk och länkad via mail — ska aldrig indexeras).
export const metadata: Metadata = {
  title: "Avbryt radering — Roots",
  description: "Avbryt pågående radering av ditt Roots-konto.",
  robots: { index: false, follow: false },
};

export default function CancelDeletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
