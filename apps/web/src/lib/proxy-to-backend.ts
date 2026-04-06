import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Hono API root (no `/v1` suffix), e.g. https://roots-xxx.up.railway.app */
export function getBackendBase(): string {
  const b =
    process.env.API_BACKEND_URL ||
    process.env.API_URL ||
    "http://127.0.0.1:4000";
  return b.replace(/\/$/, "");
}

/** Strip Domain / relax SameSite so the browser stores the cookie on the web origin. */
export function rewriteSetCookieForBrowser(cookie: string): string {
  let c = cookie.trim();
  c = c.replace(/;\s*Domain=[^;]*/gi, "");
  c = c.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
  return c;
}

export async function proxyRequestToBackend(
  req: NextRequest,
  backendPath: string
): Promise<Response> {
  const search = req.nextUrl.search;
  const target = `${getBackendBase()}${backendPath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const l = key.toLowerCase();
    if (
      l === "host" ||
      l === "connection" ||
      l === "content-length" ||
      l === "transfer-encoding" ||
      l === "cookie"
    ) {
      return;
    }
    headers.set(key, value);
  });

  const cookieHeader =
    req.headers.get("cookie") ||
    req.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  const res = await fetch(target, init);

  const outHeaders = new Headers();
  res.headers.forEach((value, key) => {
    const l = key.toLowerCase();
    if (l === "set-cookie") return;
    if (l === "content-encoding" || l === "transfer-encoding") return;
    outHeaders.append(key, value);
  });

  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")!]
        : [];

  for (const c of cookies) {
    outHeaders.append("Set-Cookie", rewriteSetCookieForBrowser(c));
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
