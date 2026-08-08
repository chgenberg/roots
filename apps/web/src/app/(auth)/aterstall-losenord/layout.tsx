import { pageMetadata } from "@/lib/seo";

// Defense-in-depth utöver robots.txt — page.tsx är "use client".
// Tokenbärande återställningslänkar ska aldrig indexeras.
export const metadata = pageMetadata({
  title: "Återställ lösenord",
  description: "Välj ett nytt lösenord till ditt Roots-konto.",
  path: "/aterstall-losenord",
  noindex: true,
});

export default function AterstallLosenordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
