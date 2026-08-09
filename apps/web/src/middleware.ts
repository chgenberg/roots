import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { LOCALE_HEADER } from "@/i18n/request-locale";
import {
  getLocaleFromPathname,
  stripLocalePrefix,
  withLocale,
} from "@/i18n/paths";

/**
 * Site-wide middleware. Two responsibilities, in order:
 *
 *   1. Pre-launch password gate. Every request without a valid
 *      `roots_preview` cookie is rewritten to /preview-gate so the
 *      user has to enter the shared password (or join the waitlist)
 *      before they can see anything. Static assets, the gate page
 *      itself, and a small allowlist of API/probe paths bypass this.
 *
 *   2. Existing role-based route protection for /forening, /lag,
 *      /min-shop. Runs only after the gate has been cleared.
 */

const PROTECTED_ROUTES: Record<string, string[]> = {
  "/forening": ["ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
  "/lag": ["TEAM_LEADER", "ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
  "/min-shop": ["SELLER", "TEAM_LEADER", "ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
  // MASTERPLAN_01 KC2.2: /portal/* gate:ades tidigare bara client-side
  // via PortalUserProvider. En oinloggad besökare kunde se laddande
  // skelett-UI tills /me failade. En SELLER kunde navigera till
  // /portal/saljare och se skelettet av ANDRA säljare. Nu kräver
  // middleware:n en av nedanstående roller, annars redirect till login
  // (om unauth) eller deras egna home (om fel roll).
  "/portal": [
    "CLUB_ADMIN",
    "CLUB_MEMBER",
    "SALES_REP",
    "SALES_ADMIN",
    "INTERNAL_ADMIN",
  ],
};

/**
 * MASTERPLAN_01 KC2.2: vart en användare hör hemma när de hamnar på en
 * sida som inte tillåter deras roll. Måste matcha roleHome() i
 * apps/web/src/app/(auth)/login/page.tsx — håll dem synkade.
 */
function roleHome(role: string | undefined): string {
  switch (role) {
    case "ASSOCIATION_ADMIN":
      return "/forening";
    case "TEAM_LEADER":
      return "/lag";
    case "SELLER":
      return "/min-shop";
    case "CLUB_ADMIN":
    case "CLUB_MEMBER":
    case "SALES_REP":
    case "SALES_ADMIN":
    case "INTERNAL_ADMIN":
      return "/portal";
    default:
      return "/login";
  }
}

// Paths that must work even when the gate cookie is missing — the
// gate page would otherwise be unreachable, and probes / OG-image
// crawlers / static assets must still be served. NOTE: the static
// asset prefixes (/_next, /brand, /fonts, /images, …) are also
// excluded via the matcher below, but keeping them in this list
// documents intent.
//
// /api is the same-origin proxy to the backend (see lib/api-base.ts).
// Bypassing it here is critical: the gate page itself calls
// /api/v1/csrf-token + /api/v1/preview/unlock to do the unlock
// handshake, and the backend already enforces its own auth + CSRF,
// so the middleware has nothing to add by rewriting these.
const GATE_BYPASS_PREFIXES = [
  "/preview-gate",
  // Föreningskalkylatorn är en publik, prospekt-specifik delningssida som
  // säljare skickar till föreningar — den måste fungera utan förhands-
  // visningslösenord även före lansering.
  "/kalkylator",
  "/api",
  "/trpc",
  "/_next",
  "/brand",
  "/fonts",
  "/images",
  "/icons",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/feed.xml",
  "/llms.txt",
  "/opengraph-image",
  "/twitter-image",
  "/.well-known",
  "/healthz",
  "/readyz",
];

const PREVIEW_COOKIE_NAME = "roots_preview";

// Web Crypto deterministic token — must produce the same string as
// apps/api/src/lib/preview-gate.ts. Sync-only flavour using the
// SubtleCrypto API which is available on both the Edge and Node
// runtimes; result is cached at module load to avoid recomputing on
// every request.
//
// P1.7 (audit 2026-05-26): returnerar `null` när SITE_PREVIEW_PASSWORD
// saknas så middleware:n kan ta säkert beslut. Tidigare defaultade vi
// till `"Roots123%"` vilket innebar att en misconfig:ad prod-deploy
// gate:ade hela sajten bakom ett gissningsbart lösenord.
async function computePreviewToken(): Promise<string | null> {
  const password = process.env.SITE_PREVIEW_PASSWORD?.trim();
  if (!password) return null;
  const data = new TextEncoder().encode(`roots-preview-v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

let cachedPreviewToken: string | null = null;
let previewTokenComputed = false;
async function getPreviewToken(): Promise<string | null> {
  if (previewTokenComputed) return cachedPreviewToken;
  cachedPreviewToken = await computePreviewToken();
  previewTokenComputed = true;
  return cachedPreviewToken;
}

function isPreviewGateDisabled(): boolean {
  return process.env.PREVIEW_GATE_DISABLED === "true";
}

// Publika sidor som är tillfälligt dolda bakom en funktionsflagga. De
// hanteras här och inte i sidan själv: notFound() i en klientkomponent
// renderar 404-sidan men hinner skicka statusen 200, och en mjuk 404 bjuder
// in crawlers till något vi gömmer. Tillfällig redirect (307) — sidan ska
// tillbaka.
const HIDDEN_ROUTES: string[] = [
  ...(HAIR_ANALYSIS_ENABLED ? [] : ["/haranalys"]),
];

function withLocaleHeaders(
  request: NextRequest,
  pathname: string
): NextResponse {
  const locale = getLocaleFromPathname(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const attachLocale = (res: NextResponse) => {
    res.headers.set(LOCALE_HEADER, locale);
    // Cookie mirrors the URL locale so client chrome can recover if a soft
    // navigation reuses a layout segment after the `/en` → `/` rewrite.
    res.cookies.set("roots_locale", locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  };

  if (locale === "en") {
    const url = request.nextUrl.clone();
    url.pathname = stripLocalePrefix(pathname);
    return attachLocale(
      NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      })
    );
  }

  return attachLocale(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const barePath = stripLocalePrefix(pathname);
  const locale = getLocaleFromPathname(pathname);

  // 0. Dolda sidor ───────────────────────────────────────────────
  if (
    HIDDEN_ROUTES.some((p) => barePath === p || barePath.startsWith(p + "/"))
  ) {
    return NextResponse.redirect(new URL(withLocale("/", locale), request.url));
  }

  // 1. Gate check ────────────────────────────────────────────────
  // Exact match OR path-segment prefix (`/api` → `/api/...`, not `/apiv2`).
  // A bare startsWith(p) previously bypassed unintended neighbors.
  const isBypassed = GATE_BYPASS_PREFIXES.some(
    (p) => barePath === p || barePath.startsWith(p + "/")
  );

  if (!isBypassed && !isPreviewGateDisabled()) {
    const expected = await getPreviewToken();
    if (!expected) {
      // P1.7: konfigurationsfel — vi får inte fall back till en
      // hårdkodad default. Skicka tillbaka 503 så ops märker att
      // SITE_PREVIEW_PASSWORD måste sättas (eller PREVIEW_GATE_DISABLED).
      const misconfigured =
        locale === "en"
          ? "Preview is misconfigured. Contact info@roots.nu."
          : "Förhandsvisningen är felkonfigurerad. Kontakta info@roots.nu.";
      return new NextResponse(misconfigured, {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    const cookie = request.cookies.get(PREVIEW_COOKIE_NAME);
    if (!cookie || cookie.value !== expected) {
      // Rewrite (not redirect) so the URL bar still shows where the
      // user *intended* to go — they'll land there after unlock.
      // Preserve locale header so /en/* unlock screens render in English.
      const gateUrl = new URL("/preview-gate", request.url);
      gateUrl.searchParams.set("next", pathname);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(LOCALE_HEADER, locale);
      const res = NextResponse.rewrite(gateUrl, {
        request: { headers: requestHeaders },
      });
      res.headers.set(LOCALE_HEADER, locale);
      return res;
    }
  }

  // 2. Role-based protection ────────────────────────────────────
  // Use a path-segment match (exact OR followed by "/") rather than a
  // raw startsWith — otherwise the "/forening" prefix would also
  // capture "/foreningsliv" (a public marketing page) and redirect
  // logged-out visitors to /login. Same risk for any future route
  // that shares a leading substring with a protected prefix.
  // Locale prefix is stripped first so /en never shields a portal path.
  const matchedPrefix = Object.keys(PROTECTED_ROUTES).find(
    (prefix) => barePath === prefix || barePath.startsWith(prefix + "/")
  );

  if (!matchedPrefix) {
    return withLocaleHeaders(request, pathname);
  }

  const sessionCookie = request.cookies.get("rootsSessionId");
  if (!sessionCookie?.value) {
    const loginUrl = new URL(withLocale("/login", locale), request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const apiUrl =
      process.env.API_BACKEND_URL || process.env.API_URL || "http://127.0.0.1:4000";
    // Utan timeout kan en hängande backend hålla varje sidladdning i
    // Next:s middleware-fönster och se ut som en död sajt.
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/trpc/auth.me`, {
      headers: {
        cookie: `rootsSessionId=${sessionCookie.value}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    // Ett API som blinkar (502/503/504 från proxyn) betyder inte att
    // sessionen är ogiltig. Skickar vi alla till /login vid varje hicka
    // ser det ut som en massutloggning mitt i ett arbetspass. 5xx och
    // nätverksfel ger istället en tillfällig felsida med samma URL kvar.
    if (res.status >= 500) {
      return serviceUnavailable(locale);
    }

    if (!res.ok) {
      const loginUrl = new URL(withLocale("/login", locale), request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const data = await res.json();
    const role = data?.result?.data?.json?.role ?? data?.result?.data?.role;
    const allowedRoles = PROTECTED_ROUTES[matchedPrefix];

    if (!role) {
      const loginUrl = new URL(withLocale("/login", locale), request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!allowedRoles.includes(role)) {
      // MASTERPLAN_01 KC2.2: hellre redirecta till deras egen home än
      // visa "Forbidden"-vägg. En SELLER som klickar en gammal länk
      // till /portal/saljare ska landa på /min-shop, inte en blank
      // 403-sida. Om vi inte vet vart de hör hemma → /login.
      const home = roleHome(role);
      if (home === barePath) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      return NextResponse.redirect(
        new URL(withLocale(home, locale), request.url)
      );
    }

    return withLocaleHeaders(request, pathname);
  } catch {
    // Timeout eller nätverksfel mot API:et — samma resonemang som 5xx ovan.
    return serviceUnavailable(locale);
  }
}

function serviceUnavailable(locale: "sv" | "en" = "sv"): NextResponse {
  const en = locale === "en";
  const title = en ? "Temporary issue — Roots" : "Tillfälligt problem — Roots";
  const heading = en
    ? "We are having a temporary issue"
    : "Vi har ett tillfälligt problem";
  const body = en
    ? "The portal cannot be reached right now. You are still signed in — please try again shortly. If it persists, email info@roots.nu."
    : "Portalen kan inte nås just nu. Du är fortfarande inloggad — försök igen om en liten stund. Kvarstår det, mejla info@roots.nu.";
  const retry = en ? "Try again" : "Försök igen";
  return new NextResponse(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf9f7;
    color:#1c1917;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:26rem;padding:2rem;text-align:center}
  h1{font-size:1.35rem;margin:0 0 .75rem}
  p{margin:0 0 1.5rem;color:#57534e}
  a{display:inline-block;background:#1c1917;color:#fff;padding:.7rem 1.6rem;
    border-radius:.5rem;text-decoration:none;font-weight:600;font-size:.9rem}
</style></head><body><main>
<h1>${heading}</h1>
<p>${body}</p>
<a href="javascript:location.reload()">${retry}</a>
</main></body></html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "30",
      },
    }
  );
}

// Match every request EXCEPT static files. The internal gate-bypass
// list above handles the rest (gate page, probes, brand assets).
export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - /_next/static  (build output)
     *  - /_next/image   (image optimisation)
     *  - file requests with an extension (.png, .jpg, .ico, .svg, .css, .js, .map, .woff2, …)
     */
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
