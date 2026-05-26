/**
 * Scout fix 2026-05-26 (FE-OPS-01): web-containerns Docker HEALTHCHECK
 * gjorde tidigare GET / vilket genom preview-gate-middleware kan svara
 * 503 (Service Unavailable) när SITE_PREVIEW_PASSWORD saknas. Det
 * triggade en restart-loop i Railway/Cloud Run och pga middleware-
 * konfiguration nådde aldrig 503-svaret några andra probes.
 *
 * Denna route bypassas av middleware (allowlist) och svarar alltid
 * 200 OK. Tunn: ingen DB/Redis-touch, ingen rendering — bara
 * process-liveness. Använd /readyz (API-side) för djupare probes.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, service: "roots-web" },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
