import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Kontakta Roots Nordic — vi hjälper er komma igång med föreningsförsäljning av naturlig hårvård.",
  openGraph: {
    title: "Kontakta Roots",
    description:
      "Kontakta Roots Nordic — vi hjälper er komma igång med föreningsförsäljning av naturlig hårvård.",
  },
};

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
