import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";

const PAGE_TITLE = "Kontakt";
const PAGE_DESCRIPTION =
  "Kontakta Roots Nordic — vi hjälper er komma igång med föreningsförsäljning av naturlig hårvård.";

export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/kontakt",
});

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Kontakt", url: "/kontakt" },
        ]}
      />
      <WebPageJsonLd
        type="ContactPage"
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/kontakt"
      />
      {children}
    </>
  );
}
