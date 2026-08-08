import type { Metadata } from "next";

// Orderbekräftelse innehåller personuppgifter — ska aldrig indexeras.
export const metadata: Metadata = {
  title: "Orderbekräftelse",
  description: "Bekräftelse på din Roots-beställning.",
  robots: { index: false, follow: false },
};

export default function ShopBekraftelseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
