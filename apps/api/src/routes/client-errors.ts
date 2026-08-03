/**
 * Insamling av frontend-fel.
 *
 * API:t har haft Sentry sedan Sprint D+1, webben har inte haft något. Ett
 * fel i en React-render, en kraschad checkout-knapp eller ett trasigt
 * fetch-anrop syntes därför bara i besökarens egen konsol — vi fick veta
 * om det när någon råkade mejla. Det är en dålig position att vara i på en
 * sajt där felet kan sitta mellan "lägg i varukorg" och betalning.
 *
 * I stället för att lägga in @sentry/nextjs (egen SDK, bygg-plugin,
 * publik DSN i klientbundlen) skickar webben felen hit och vi vidarebe-
 * fordrar dem till samma Sentry-projekt via befintlig captureException.
 * Fördelarna: DSN:en stannar på servern, frontend-fel hamnar i samma
 * ström som API-felen med samma request-id-konvention, och vi lägger inte
 * till ett kilobyte i klientbundlen för att kunna se fel.
 *
 * Endpointen är öppen — publika sidor kräver ingen session och ett fel som
 * inträffar innan inloggning är precis det vi vill se. Skyddet är därför
 * hårt tak per IP, strikta storleksgränser och att vi aldrig tolkar
 * innehållet, bara vidarebefordrar det som text.
 */

import { Hono } from "hono";
import { z } from "zod";
import { captureException } from "../lib/sentry";
import { checkRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";

const log = childLogger("client-errors");

export const clientErrors = new Hono();

const ClientErrorSchema = z.object({
  message: z.string().min(1).max(1000),
  /** Stack eller componentStack — trunkeras, vi behöver inte hela. */
  stack: z.string().max(8000).optional(),
  /** Var i appen felet inträffade. */
  url: z.string().max(500).optional(),
  /**
   * Vad som fångade felet. Gör det möjligt att skilja en render-krasch
   * från ett obehandlat promise-fel i Sentry-sökningen.
   */
  kind: z
    .enum(["render", "global", "unhandledrejection", "manual"])
    .default("manual"),
  /** Next.js digest för server-komponenter, om det finns. */
  digest: z.string().max(200).optional(),
  release: z.string().max(200).optional(),
});

/**
 * En trasig sida kan generera fel i en loop — en useEffect som kastar vid
 * varje render blir hundratals rapporter per sekund. Taket skyddar både
 * Sentry-kvoten och vår egen bandbredd.
 */
async function clientErrorRateLimit(ip: string) {
  return checkRateLimit(`client-error:${ip}`, 20, 60 * 60);
}

/**
 * Fel som inte säger oss något men fyller kvoten. De kommer från
 * browser-extensions, blockerade tredjepartsskript och nätverk som dör
 * mitt i en navigering — inget vi kan åtgärda i vår kod.
 */
const IGNORED_PATTERNS: ReadonlyArray<RegExp> = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Failed to fetch dynamically imported module/i,
  /Load failed/i,
  /NetworkError when attempting to fetch/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /^Script error\.?$/i,
];

function shouldIgnore(message: string, stack?: string): boolean {
  const haystack = `${message}\n${stack ?? ""}`;
  return IGNORED_PATTERNS.some((p) => p.test(haystack));
}

clientErrors.post("/client-errors", async (c) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  const rate = await clientErrorRateLimit(ip);
  if (!rate.allowed) {
    // 204 i stället för 429: klienten ska aldrig visa ett fel för att
    // felrapporteringen är full. Vi tappar rapporten medvetet.
    return c.body(null, 204);
  }

  let parsed;
  try {
    parsed = ClientErrorSchema.safeParse(await c.req.json());
  } catch {
    return c.body(null, 204);
  }
  if (!parsed.success) return c.body(null, 204);

  const { message, stack, url, kind, digest, release } = parsed.data;

  if (shouldIgnore(message, stack)) {
    return c.body(null, 204);
  }

  const sessionUser = c.get("sessionUser" as never) as
    | { userId: string; role: string; orgId: string | null }
    | undefined;

  // Vi bygger ett Error-objekt så Sentry grupperar på meddelandet och
  // visar stacken. Klientens stack är minifierad utan source maps, men
  // meddelande + URL + kind räcker nästan alltid för att hitta stället.
  const error = new Error(message);
  error.name = `WebError(${kind})`;
  if (stack) error.stack = `${error.name}: ${message}\n${stack}`;

  captureException(error, {
    tags: {
      source: "web",
      kind,
      ...(release ? { webRelease: release } : {}),
      ...(sessionUser?.role ? { role: sessionUser.role } : {}),
    },
    extra: {
      url: url ?? null,
      digest: digest ?? null,
      userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
      ...(sessionUser
        ? { userId: sessionUser.userId, orgId: sessionUser.orgId }
        : {}),
    },
  });

  log.warn({ message, url, kind, userId: sessionUser?.userId }, "web error");

  return c.body(null, 204);
});
