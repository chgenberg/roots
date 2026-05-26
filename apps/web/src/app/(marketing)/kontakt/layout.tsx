import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Kontakt",
  description:
    "Kontakta Roots Nordic — vi hjälper er komma igång med föreningsförsäljning av naturlig hårvård.",
  path: "/kontakt",
});

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
