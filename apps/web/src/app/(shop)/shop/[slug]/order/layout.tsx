import type { Metadata } from "next";

// Orderstatus är token-/id-skyddad — noindex som defense-in-depth.
export const metadata: Metadata = {
  title: "Orderstatus",
  description: "Status för din Roots-beställning.",
  robots: { index: false, follow: false },
};

export default function ShopOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
