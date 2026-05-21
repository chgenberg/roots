import type { Metadata } from "next";
import Script from "next/script";
import { OrganizationJsonLd } from "@/components/json-ld";
import { Providers } from "./providers";
import { inter, alanSans } from "@/lib/fonts";
import "./globals.css";

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
  // Sprint E13: brandbook symbol used as favicon + app icon. The
  // 4000×4000 source is resized by Next on demand; we pass the same
  // file for every slot so iOS, Android and desktop tabs all match.
  icons: {
    icon: [
      { url: "/brand/roots-symbol-dark.png", type: "image/png" },
    ],
    apple: [
      { url: "/brand/roots-symbol-dark.png" },
    ],
    shortcut: ["/brand/roots-symbol-dark.png"],
  },
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
    <html
      lang="sv"
      // Sprint E13 — expose BOTH font variables so globals.css can route
      // body → Inter and h1-h6 → Alan Sans automatically.
      className={`${inter.variable} ${alanSans.variable}`}
      suppressHydrationWarning
    >
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
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
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
