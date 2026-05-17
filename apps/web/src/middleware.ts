import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Sprint E2: the legacy "/club" route-group has been removed — CLUB
// users now land on /portal (handled by the login redirector). The
// matcher below intentionally drops "/club" so no stale request gets
// proxied to /trpc/auth.me for a route that no longer exists.
const PROTECTED_ROUTES: Record<string, string[]> = {
  "/sales": ["SALES_REP", "SALES_ADMIN", "INTERNAL_ADMIN"],
  "/forening": ["ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
  "/lag": ["TEAM_LEADER", "ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
  "/min-shop": ["SELLER", "TEAM_LEADER", "ASSOCIATION_ADMIN", "INTERNAL_ADMIN"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedPrefix = Object.keys(PROTECTED_ROUTES).find((prefix) =>
    pathname.startsWith(prefix)
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

    if (!role || !allowedRoles.includes(role)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/sales/:path*",
    "/forening/:path*",
    "/lag/:path*",
    "/min-shop/:path*",
  ],
};
