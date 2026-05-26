import type { Metadata } from "next";

// P3.58 (audit 2026-05-26): defense-in-depth utöver robots.txt — lägg
// noindex på själva sidan så att även rouge-crawlers som ignorerar
// robots.txt får tagg-baserad signal.
export const metadata: Metadata = {
  title: "Logga in",
  description: "Logga in på Roots-portalen för att hantera er förening, lag eller försäljning.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Logga in — Roots",
    description: "Logga in på Roots-portalen.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
