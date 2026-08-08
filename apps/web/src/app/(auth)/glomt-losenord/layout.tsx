import type { Metadata } from "next";
import { getAuth } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getAuth("forgot", locale);
  return pageMetadata({
    title: t.metaTitle,
    description: t.metaDescription,
    path: "/glomt-losenord",
    locale,
    noindex: true,
  });
}

export default function GlomtLosenordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
