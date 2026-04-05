import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logga in",
  description: "Logga in på Roots-portalen för att hantera er förening, lag eller försäljning.",
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
