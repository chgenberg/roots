/**
 * Rapportering av frontend-fel till API:t, som skickar vidare till Sentry.
 *
 * Se apps/api/src/routes/client-errors.ts för varför felen tar vägen via
 * vårt eget API i stället för en Sentry-SDK i klienten.
 *
 * Två regler styr designen: rapporteringen får aldrig kasta (då blir
 * felrapporteringen själv ett fel i en error boundary), och den får aldrig
 * blockera. Därför sendBeacon när det finns — den överlever att sidan
 * stängs eller navigerar bort, vilket är precis vad som händer när något
 * kraschar.
 */

import { getBrowserApiBase } from "./api-base";

const ENDPOINT = "/v1/telemetry/client-errors";

export type WebErrorKind =
  | "render"
  | "global"
  | "unhandledrejection"
  | "manual";

interface ReportOptions {
  kind?: WebErrorKind;
  digest?: string;
  /** Extra kontext, t.ex. React componentStack. */
  componentStack?: string;
}

/**
 * Samma fel i en render-loop kan bli hundratals rapporter per sekund. Vi
 * släpper igenom varje unikt meddelande en gång per sidladdning; API:t har
 * dessutom ett eget tak per IP.
 */
const reported = new Set<string>();
const MAX_UNIQUE_PER_PAGE = 10;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return "Unknown error";
  }
}

export function reportWebError(error: unknown, options: ReportOptions = {}): void {
  if (typeof window === "undefined") return;

  try {
    const message = messageOf(error);
    if (!message) return;

    const key = `${options.kind ?? "manual"}:${message}`;
    if (reported.has(key) || reported.size >= MAX_UNIQUE_PER_PAGE) return;
    reported.add(key);

    const stackParts = [
      error instanceof Error && error.stack ? error.stack : "",
      options.componentStack ? `\nComponent stack:${options.componentStack}` : "",
    ].filter(Boolean);

    const payload = JSON.stringify({
      message: message.slice(0, 1000),
      stack: stackParts.join("").slice(0, 8000) || undefined,
      url: window.location.href.slice(0, 500),
      kind: options.kind ?? "manual",
      digest: options.digest,
    });

    const url = `${getBrowserApiBase()}${ENDPOINT}`;
    const blob = new Blob([payload], { type: "application/json" });

    if (navigator.sendBeacon?.(url, blob)) return;

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      // Tystnad är rätt här. Att felrapporteringen inte gick fram är
      // ingenting besökaren kan göra något åt.
    });
  } catch {
    // Se ovan — rapportering får aldrig eskalera.
  }
}

/**
 * Installerar globala lyssnare. Anropas en gång från rot-layouten.
 * Returnerar en avregistrerare för React-strict-mode-städning.
 */
export function installGlobalErrorReporting(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    reportWebError(event.error ?? event.message, { kind: "global" });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportWebError(event.reason, { kind: "unhandledrejection" });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
