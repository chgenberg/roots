import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrera",
  description:
    "Skapa konto på Roots — registrera er förening eller lag för att börja sälja naturlig hårvård.",
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
