import { pageMetadata } from "@/lib/seo";

// Defense-in-depth utöver robots.txt — page.tsx är "use client".
export const metadata = pageMetadata({
  title: "Glömt lösenord",
  description: "Återställ lösenordet till ditt Roots-konto.",
  path: "/glomt-losenord",
  noindex: true,
});

export default function GlomtLosenordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
