import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Gate check ────────────────────────────────────────────────
  const isBypassed = GATE_BYPASS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)
  );

  if (!isBypassed && !isPreviewGateDisabled()) {
    const expected = await getPreviewToken();
    if (!expected) {
      // P1.7: konfigurationsfel — vi får inte fall back till en
      // hårdkodad default. Skicka tillbaka 503 så ops märker att
      // SITE_PREVIEW_PASSWORD måste sättas (eller PREVIEW_GATE_DISABLED).
      return new NextResponse(
        "Förhandsvisningen är felkonfigurerad. Kontakta hej@roots.se.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    const cookie = request.cookies.get(PREVIEW_COOKIE_NAME);
    if (!cookie || cookie.value !== expected) {
      // Rewrite (not redirect) so the URL bar still shows where the
      // user *intended* to go — they'll land there after unlock.
      const gateUrl = new URL("/preview-gate", request.url);
      gateUrl.searchParams.set("next", pathname);
      return NextResponse.rewrite(gateUrl);
    }
  }

  // 2. Role-based protection ────────────────────────────────────
  // Use a path-segment match (exact OR followed by "/") rather than a
  // raw startsWith — otherwise the "/forening" prefix would also
  // capture "/foreningsliv" (a public marketing page) and redirect
  // logged-out visitors to /login. Same risk for any future route
  // that shares a leading substring with a protected prefix.
  const matchedPrefix = Object.keys(PROTECTED_ROUTES).find(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (!matchedPrefix) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("rootsSessionId");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const apiUrl =
      process.env.API_BACKEND_URL || process.env.API_URL || "http://127.0.0.1:4000";
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/trpc/auth.me`, {
      headers: {
        cookie: `rootsSessionId=${sessionCookie.value}`,
      },
    });

    if (!res.ok) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const data = await res.json();
    const role = data?.result?.data?.json?.role ?? data?.result?.data?.role;
    const allowedRoles = PROTECTED_ROUTES[matchedPrefix];

    if (!role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!allowedRoles.includes(role)) {
      // MASTERPLAN_01 KC2.2: hellre redirecta till deras egen home än
      // visa "Forbidden"-vägg. En SELLER som klickar en gammal länk
      // till /portal/saljare ska landa på /min-shop, inte en blank
      // 403-sida. Om vi inte vet vart de hör hemma → /login.
      const home = roleHome(role);
      if (home === pathname) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      return NextResponse.redirect(new URL(home, request.url));
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
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
