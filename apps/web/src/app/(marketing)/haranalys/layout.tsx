import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gratis håranalys online | Roots",
  description:
    "Få en personlig AI-driven håranalys helt gratis. Ladda upp två bilder, svara på frågor om dina vanor och få skräddarsydda rekommendationer med nordiska ingredienser.",
  openGraph: {
    title: "Gratis håranalys online | Roots",
    description:
      "Personlig AI-håranalys på under 2 minuter. Helt gratis, inga dolda kostnader.",
  },
};

export default function HaranalysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
