import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { OrganizationJsonLd } from "@/components/json-ld";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Roots — Föreningsnära hudvård",
    default: "Roots — Föreningsnära hudvård",
  },
  description:
    "Naturlig hudvård för föreningslivet. Schampo, balsam och kroppstvätt — utvecklat i Norden.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
  ),
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "Roots",
    images: [
      {
        url: "/images/h1desktop.jpg",
        width: 1200,
        height: 630,
        alt: "Roots — Naturlig hårvård",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/h1desktop.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="sv" className={inter.variable} suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen bg-background font-[family-name:var(--font-inter)] text-foreground antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-inverse-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-inverse-on-surface focus:shadow-lg"
        >
          Hoppa till innehåll
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
