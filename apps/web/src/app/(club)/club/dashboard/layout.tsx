import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function ClubDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
