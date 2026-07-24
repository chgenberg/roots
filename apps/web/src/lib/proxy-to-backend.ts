import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Hur länge vi väntar på backend innan vi ger upp. Måste vara längre än de
 * långsammaste legitima anropen men klart kortare än undicis default, så
 * användaren får ett riktigt felmeddelande i stället för ett rått "fetch
 * failed".
 *
 * Taket är per rutt, inte globalt. Webbläsaren går alltid via den här proxyn
 * (`getBrowserApiBase()` returnerar "/api"), så ett globalt tak på 25 s klippte
 * håranalysen — den får ta 120 s på API-sidan och användaren fick en 504
 * medan API:et fortfarande arbetade.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS) || 25_000;

/**
 * Håranalysen: API:et tillåter OPENAI_HAIR_ANALYSIS_TIMEOUT_MS (120 s) med ett
 * hårt tak på 180 s. Vi lägger oss strax ovanför taket så att API:ets eget
 * timeout-svar hinner fram — då får användaren dess felmeddelande i stället
 * för vårt 504.
 */
const HAIR_ANALYSIS_TIMEOUT_MS =
  Number(process.env.API_PROXY_AI_TIMEOUT_MS) || 185_000;

/** Övriga AI-rutter: chat/streaming avbryts av API:et efter ~30 s. */
const AI_TIMEOUT_MS = 60_000;

function timeoutForPath(backendPath: string): number {
  if (backendPath.startsWith("/v1/ai/hair-analysis")) {
    return HAIR_ANALYSIS_TIMEOUT_MS;
  }
  if (backendPath.startsWith("/v1/ai/")) return AI_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

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

/**
 * Klientens IP så som den betrodda proxyn såg den.
 *
 * Plattformens edge-proxy lägger till den verkliga avsändaren sist i
 * `x-forwarded-for`, medan allt före kan vara satt av klienten själv. Sista
 * posten är därför den enda vi kan lita på. Antalet betrodda hopp kan justeras
 * med `TRUSTED_PROXY_HOPS` om deploy-topologin får fler lager.
 */
function trustedClientIp(req: NextRequest): string | null {
  const parts = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  return parts[Math.max(0, parts.length - hops)] ?? null;
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
      l === "cookie" ||
      // Sätts om nedan från den betrodda posten — se trustedClientIp().
      l === "x-forwarded-for" ||
      l === "x-real-ip"
    ) {
      return;
    }
    headers.set(key, value);
  });

  // API:et nycklar all per-IP-begränsning på den FÖRSTA posten i
  // `x-forwarded-for` (inloggningsförsök, registrering, checkout, AI-budgetar,
  // förhandsvisningens lösenord). Headern är inte förbjuden i fetch-specen, så
  // en webbläsare kan sätta den själv, och plattformens proxy *lägger till*
  // den riktiga IP:n sist i stället för att ersätta värdet. Vidarebefordrade vi
  // headern rakt igenom räckte det alltså att räkna upp ett tal per request för
  // att kringgå samtliga gränser. Vi skickar därför bara den betrodda posten.
  const clientIp = trustedClientIp(req);
  if (clientIp) headers.set("x-forwarded-for", clientIp);

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
    // Utan egen timeout ärver vi undicis headers-timeout: anropet hänger ~30 s
    // och kastar sedan ett rått "fetch failed" som blir en 500 för användaren.
    // Hellre ett tydligt 504 i tid — men taket måste rymma rutten, se
    // timeoutForPath().
    signal: AbortSignal.timeout(timeoutForPath(backendPath)),
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(
      `[proxy] ${req.method} ${backendPath} ${timedOut ? "timeout" : "misslyckades"}`,
      err
    );
    return NextResponse.json(
      {
        error: timedOut
          ? "Servern svarade inte i tid. Försök igen."
          : "Kunde inte nå servern. Försök igen.",
      },
      { status: timedOut ? 504 : 502 }
    );
  }

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
