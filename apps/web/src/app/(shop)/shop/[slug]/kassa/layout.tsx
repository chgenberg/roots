import type { Metadata } from "next";

// Checkout är privat köpflöde — noindex även om robots.txt ignoreras.
export const metadata: Metadata = {
  title: "Kassa",
  description: "Slutför ditt köp i Roots personliga shop.",
  robots: { index: false, follow: false },
};

export default function ShopKassaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
