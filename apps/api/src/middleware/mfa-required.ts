import type { Context, Next } from "hono";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";

const log = childLogger("mfa-guard");

/**
 * Stänger API:et för roller som kräver tvåfaktor men saknar den.
 *
 * Varför en global middleware och inte en kontroll per route: rollkraven
 * ligger utspridda på trettiotalet ställen bara i portal.ts. Att lägga in
 * en MFA-kontroll i var och en av dem betyder att den som lägger till
 * endpoint nummer trettiofem måste komma ihåg det, och den som glömmer
 * lämnar hela hålet öppet. Här är utgångsläget stängt och undantagen
 * uppräknade, vilket är den ordning man vill ha på ett skydd.
 *
 * Bara INTERNAL_ADMIN och SALES_ADMIN får `mfaPending` (se
 * MFA_REQUIRED_ROLES), så en säljare eller lagledare påverkas inte alls.
 *
 * Sessionen skapas ändå vid inloggning. Alternativet — att vägra logga in
 * helt — hade låst ut varje befintlig administratör i samma sekund som
 * kravet slogs på, och den enda utvägen hade varit att stänga av kravet
 * igen. Nu kommer de in, ser en uppmaning och kan registrera sin app.
 */

/**
 * Vad en administratör utan registrerad app ändå måste nå: sig själv,
 * utloggning, CSRF-token och själva registreringen. Utan dessa går det inte
 * att komma ur läget.
 */
const ALLOWED_PREFIXES = [
  "/v1/auth/me",
  "/v1/auth/logout",
  "/v1/auth/mfa",
  "/v1/auth/login",
  "/v1/auth/change-password",
  "/v1/csrf-token",
  "/health",
  "/healthz",
  "/readyz",
];

/**
 * Webbappens middleware slår upp rollen via den här tRPC-proceduren innan
 * varje skyddad sidladdning. Blockerar vi den kan en administratör inte ens
 * nå inställningarna: rollkontrollen får 403, middlewaren tolkar det som en
 * ogiltig session och skickar till /login, där inloggningen lyckas och
 * skickar tillbaka — en loop utan utväg.
 *
 * Exakt matchning, inte prefix: tRPC kan batcha flera procedurer i samma
 * URL (`/trpc/auth.me,orders.list`), och en sådan batch ska fortfarande
 * stoppas.
 */
const ALLOWED_EXACT = new Set(["/trpc/auth.me"]);

function isAllowed(path: string): boolean {
  if (ALLOWED_EXACT.has(path)) return true;
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function mfaRequired(c: Context, next: Next) {
  if (isAllowed(c.req.path)) return next();

  let session;
  try {
    session = await requireSession(c);
  } catch (err) {
    // Kan vi inte läsa sessionen är det inte den här middlewarens sak att
    // avgöra vad som ska hända — routens egen guard får neka.
    log.warn({ err }, "session lookup failed in MFA guard");
    return next();
  }

  if (!session?.mfaPending) return next();

  return c.json(
    {
      error:
        "Din roll kräver tvåfaktorsautentisering. Registrera en autentiseringsapp under Inställningar för att fortsätta.",
      mfaEnrollmentRequired: true,
    },
    403
  );
}
