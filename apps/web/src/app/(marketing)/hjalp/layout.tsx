import { pageMetadata } from "@/lib/seo";

/**
 * MASTERPLAN_01 KC7.4: page.tsx är "use client" och kan därför inte
 * själv exportera metadata. Vi lägger den i en server-side layout
 * istället. Layouten gör inget annat än att rendera children — Next
 * mergar metadata från layout+page automatiskt.
 */
export const metadata = pageMetadata({
  title: "Hjälp & vanliga frågor",
  description:
    "Snabba svar för supportrar, säljare, lagledare och föreningar — eller kontakta vårt team direkt.",
  path: "/hjalp",
});

export default function HjalpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
