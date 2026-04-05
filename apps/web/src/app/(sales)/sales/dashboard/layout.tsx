import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sälj-Dashboard" };

export default function SalesDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
