import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@roots/ui", "@roots/contracts"],
  typescript: {
    // P2.38 (audit 2026-05-26): vi vill att build alltid type-checkar.
    // Tidigare lät vi Dockerfile sätta SKIP_TYPECHECK=true permanent
    // → typfel kunde åka rakt ut i prod-image. Nu kräver vi att opt-
    // out:en är en explicit env (ROOTS_FORCE_SKIP_TYPECHECK) och vi
    // håller SKIP_TYPECHECK kvar bara för retro-kompatibilitet
    // medan vi rullar ut nya Dockerfiles. Hela CI/CD bör i normalfall
    // ha varken satt så typecheck körs.
    ignoreBuildErrors:
      process.env.SKIP_TYPECHECK === "true" ||
      process.env.ROOTS_FORCE_SKIP_TYPECHECK === "true",
  },
  eslint: {
    // P2.39 (audit 2026-05-26): aktivera ESLint under next build.
    // Tidigare ignoreDuringBuilds: true → no-floating-promise,
    // exhaustive-deps, no-explicit-any landade tyst i prod. Kan
    // opt-as via ROOTS_FORCE_SKIP_LINT under akut hotfix.
    ignoreDuringBuilds: process.env.ROOTS_FORCE_SKIP_LINT === "true",
  },
  images: {
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // P2.37 (audit 2026-05-26): CSP är nu enforced.
    //
    // Tidigare körde vi report-only vilket inte stoppade XSS-payloads
    // utan bara loggade dem. Vi tillåter Klarna (checkout.js + iframe),
    // Plausible och Sentry. `'unsafe-inline'` på script är fortfarande
    // tyvärr nödvändigt p.g.a. Next.js inline-bootstrap; planerad
    // upgrade till nonce/hash gör att vi kan ta bort det senare.
    //
    // Sätt `ROOTS_CSP_REPORT_ONLY=true` i staging för att kunna iterera
    // utan att bryta checkout. I prod är policyn alltid enforced.
    //
    // P3.49 (audit 2026-05-26): `'unsafe-eval'` behövs bara av
    // Next.js dev-server (HMR + react-refresh). Ta bort den i
    // produktion så att en eventuell XSS inte kan svänga till eval-
    // baserad RCE.
    // P3.50 (audit 2026-05-26): bibehåller `'unsafe-inline'` på
    // script-src tills vi kan rulla ut nonce-baserad CSP. Planen
    // är att en framtida middleware injicerar per-request nonce
    // och vi då kan lägga till 'strict-dynamic'. För nu är allow-
    // listan över Klarna/Plausible/Sentry den faktiska kontrollen.
    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      ...(!isProd ? ["'unsafe-eval'"] : []),
      "https://x.klarnacdn.net",
      "https://*.klarna.com",
      "https://plausible.io",
      "https://*.sentry.io",
    ].join(" ");

    const cspDirectives = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://x.klarnacdn.net",
      "img-src 'self' data: blob: https://x.klarnacdn.net https://*.klarna.com",
      "font-src 'self' data: https://x.klarnacdn.net",
      "connect-src 'self' https://*.railway.app https://*.klarna.com https://plausible.io https://*.sentry.io https://*.ingest.sentry.io",
      "frame-src 'self' https://*.klarna.com https://x.klarnacdn.net",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.klarna.com",
      "object-src 'none'",
      // P3.50 (audit 2026-05-26): explicit worker-src så att Service
      // Workers inte kan injiceras från tredje part.
      "worker-src 'self' blob:",
      // P3.50 (audit 2026-05-26): manifest-src för PWA-säkerhet.
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ];
    const cspValue = cspDirectives.join("; ");
    const cspHeaderKey =
      process.env.ROOTS_CSP_REPORT_ONLY === "true"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            // P3.51 (audit 2026-05-26): utöka deny-list till sensorer
            // vi inte använder.
            // Pre-push fix 2026-05-26: tidigare hade vi `payment=()`
            // vilket BLOCKERAR Payment Request API (Apple Pay/Google
            // Pay) i Klarnas checkout-iframe. Klarna kan fortfarande
            // visa Wallet-knapparna men de slutar fungera. Delegera
            // istället till `self` + Klarna-domänen så Wallet-flöden
            // funkar utan att en obetrodd tredjepart kan trigga
            // payment-prompts.
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self \"https://*.klarna.com\"), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // P3.51 (audit 2026-05-26): Cross-Origin Opener Policy isolerar
          // browsing-context från popups (skydd mot Spectre + tab-
          // napping). `same-origin` är säker eftersom vi själva inte
          // litar på cross-origin window-handlar.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          // P3.51 (audit 2026-05-26): Cross-Origin Resource Policy gör
          // att andra origins inte kan embed:a våra svar (skydd mot
          // ClickJacking-liknande exfiltrering). Klarna-iframes laddas
          // FRÅN dem mot vår sida, inte vice versa, så same-site är OK.
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          // OBS: vi sätter MEDVETET inte Cross-Origin-Embedder-Policy
          // (COEP). COEP kräver att alla externa resurser exponerar
          // CORP-headers eller använder credentialless mode, vilket
          // skulle bryta Klarna-checkout-iframe. Lägg in senare när
          // vi har auditat Klarnas headers.
          {
            key: cspHeaderKey,
            value: cspValue,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
