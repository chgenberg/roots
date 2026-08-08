import { BreadcrumbJsonLd, FaqJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { HELP_PUBLIC_FAQS } from "@/lib/help-faqs";
import { pageMetadata } from "@/lib/seo";

/**
 * MASTERPLAN_01 KC7.4: page.tsx är "use client" och kan därför inte
 * själv exportera metadata. Vi lägger den i en server-side layout
 * istället. Layouten gör inget annat än att rendera children — Next
 * mergar metadata från layout+page automatiskt.
 *
 * FaqJsonLd / WebPageJsonLd bor här av samma skäl: JSON-LD måste
 * renderas server-side.
 */
const PAGE_TITLE = "Hjälp & vanliga frågor";
const PAGE_DESCRIPTION =
  "Snabba svar för supportrar, säljare, lagledare och föreningar — eller kontakta vårt team direkt.";

export const metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/hjalp",
});

export default function HjalpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Hjälp", url: "/hjalp" },
        ]}
      />
      <WebPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/hjalp"
      />
      <FaqJsonLd faqs={HELP_PUBLIC_FAQS} />
      {children}
    </>
  );
}
