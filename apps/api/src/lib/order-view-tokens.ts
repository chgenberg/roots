/**
 * P1.5 (audit 2026-05-26) — signed tokens för publika order-status-länkar.
 *
 * Tidigare lät `GET /v1/checkout/order-status/:orderId` vem som helst
 * läsa kundnamn, produktinnehåll, beloppen, säljarens shop-slug osv
 * bara man kände till order-UUID:n. UUID:n hamnar i:
 *   - Stripe confirmation-URL (Referer-header läcker till tredje-part)
 *   - Bekräftelse-mailet (vidare-skickas, indexeras av extensions)
 *   - Browser-history på delade datorer
 *
 * GDPR-fyndet kräver att vi gates:ar endpointen. Att kräva login är
 * inte aktuellt — kunden har ingen Roots-konto. Istället signerar vi
 * en kort token vid checkout-creation och bäddar in i URL:en som
 * skickas till kunden. Token = HMAC(orderId) + 30-dagars TTL.
 *
 * Säkerhetsegenskaper:
 *   - Endpointen kan fortfarande nås utan login (krav från supporter-
 *     flödet) men *bara* med en token som motsvarar precis denna order.
 *   - 30 dagar matchar bekräftelse-mailets praktiska giltighet (kunder
 *     går ofta tillbaka för att se sin order). Längre TTL ökar leak-risk.
 *   - Tokens länkar enbart till read-only data — ingen mutation går
 *     genom denna endpoint.
 *   - Secret = `ORDER_VIEW_TOKEN_SECRET` med fallback till
 *     `SESSION_SECRET` (samma policy som deletion-tokens). I prod kräver
 *     validate-env att åtminstone en är satt.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const ONE_DAY_S = 60 * 60 * 24;
export const ORDER_VIEW_TOKEN_TTL_S = 30 * ONE_DAY_S;

class OrderViewTokenConfigError extends Error {}

function getSecret(): string {
  const secret =
    process.env.ORDER_VIEW_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") {
    // P1.5 + P1.8: fail-closed i prod — bättre att checkout-mailen
    // saknar order-status-länk en stund än att vi minter förutsägbara
    // tokens från en hårdkodad dev-default.
    throw new OrderViewTokenConfigError(
      "Order view token secret missing in production (set ORDER_VIEW_TOKEN_SECRET or SESSION_SECRET, min 16 chars)."
    );
  }
  // Dev: stabil per-process secret så samma server-restart inte
  // ogiltigförklarar nyligen utfärdade tokens. Räcker för lokal
  // testning; aldrig samma värde som något vi någonsin shippar.
  return "roots-order-view-dev-secret-do-not-use-in-prod";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issueOrderViewToken(
  orderId: string,
  ttlSec: number = ORDER_VIEW_TOKEN_TTL_S
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${orderId}.${expiresAt}`;
  return `${expiresAt}.${sign(payload)}`;
}

export interface VerifiedOrderViewToken {
  orderId: string;
  expiresAt: number;
}

export function verifyOrderViewToken(
  orderId: string,
  token: string | undefined | null
): VerifiedOrderViewToken | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [expiresStr, providedSig] = parts;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (Date.now() / 1000 > expiresAt) return null;

  let expectedSig: string;
  try {
    expectedSig = sign(`${orderId}.${expiresStr}`);
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length) return null;
  const a = Buffer.from(expectedSig, "hex");
  const b = Buffer.from(providedSig, "hex");
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { orderId, expiresAt };
}
