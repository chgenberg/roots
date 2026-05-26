import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Gratis håranalys online",
  description:
    "Få en personlig AI-driven håranalys helt gratis. Ladda upp två bilder, svara på frågor om dina vanor och få skräddarsydda rekommendationer med nordiska ingredienser.",
  path: "/haranalys",
});

export default function HaranalysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
