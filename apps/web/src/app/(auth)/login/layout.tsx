import type { Metadata } from "next";
import { getAuth } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getAuth("login", locale);
  return pageMetadata({
    title: t.metaTitle,
    description: t.metaDescription,
    path: "/login",
    locale,
    noindex: true,
  });
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
