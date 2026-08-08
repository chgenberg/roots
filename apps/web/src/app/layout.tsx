import type { Metadata } from "next";
import Script from "next/script";
import { OrganizationJsonLd, SiteJsonLd } from "@/components/json-ld";
import { Providers } from "./providers";
import { inter, alanSans } from "@/lib/fonts";
import "./globals.css";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title: {
    template: "%s | Roots — Föreningsnära hårvård",
    default: "Roots — Föreningsnära hårvård",
  },
  description:
    "Naturlig hårvård för föreningslivet. Schampo, balsam och body wash — utvecklat i Norden.",
  metadataBase: new URL(siteUrl),
  // Brandbook symbol as favicon + app icon, pre-rendered per size by
  // scripts/build-favicons.py. Earlier revisions pointed every slot at the
  // 4000×4000 brand source on the assumption Next would resize it — it
  // doesn't for metadata icons, so Safari drew no tab icon at all and every
  // visitor fetched 130 kB for a 16px slot.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  // discovery: RSS for guider — pairs with app/feed.xml/route.ts
  alternates: {
    types: {
      "application/rss+xml": `${siteUrl}/feed.xml`,
    },
  },
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "Roots",
  },
  twitter: {
    card: "summary_large_image",
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
        {/*
         * Temat måste sättas innan första målningen, annars blinkar sidan
         * vit en bildruta för den som valt mörkt läge. Tidigare satte
         * ThemeToggle klassen i en useEffect, och eftersom växeln bara
         * finns i marketing-headern blev portalen ljus vid direktladdning
         * men mörk om man klickat sig dit — samma sida, två utseenden.
         *
         * Systemets prefers-color-scheme läses avsiktligt inte: med "Auto"
         * på macOS och iOS slår den om vid solnedgången, så besökare som
         * aldrig bett om mörkt läge fick sajten mörk på kvällen.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("roots-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <OrganizationJsonLd />
        {/* MASTERPLAN_01 KC7.10: site-wide WebSite + SearchAction JSON-LD
            så Google kan rendera brand-search-box i sitelinks. */}
        <SiteJsonLd />
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
