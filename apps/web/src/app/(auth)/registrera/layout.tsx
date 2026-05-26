import type { Metadata } from "next";

// P3.58 (audit 2026-05-26): noindex som defense-in-depth utöver robots.txt.
export const metadata: Metadata = {
  title: "Registrera",
  description:
    "Skapa konto på Roots — registrera er förening eller lag för att börja sälja naturlig hårvård.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Registrera — Roots",
    description:
      "Skapa konto på Roots — registrera er förening eller lag.",
  },
};

export default function RegistreraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
