import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = {
  "/club": ["CLUB_ADMIN", "CLUB_MEMBER"],
  "/sales": ["SALES_REP", "SALES_ADMIN", "INTERNAL_ADMIN"],
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

  // Validate session by calling the API
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
    const allowedRoles =
      PROTECTED_ROUTES[matchedPrefix as keyof typeof PROTECTED_ROUTES];

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
  matcher: ["/club/:path*", "/sales/:path*"],
};
