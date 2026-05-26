"use client";

/**
 * MASTERPLAN_01 KC2.7 — publik "ångra radering"-sida.
 *
 * Användaren landar här via länken i `deletionRequestEmail`-mailen.
 * Token i query-string är signed (HMAC) och innehåller userId +
 * expires. Vi visar en bekräftelse-knapp (inte auto-cancel — vi vill
 * inte att en email-preview-fetch ska trigga cancel av misstag).
 *
 * Sidan är publik — kräver INGEN login. Detta är medvetet: om
 * användaren har glömt sitt lösenord ska de fortfarande kunna ångra
 * raderingen.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

function CancelDeletionInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<
    "idle" | "submitting" | "success" | "expired" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Pre-validera token i UI:t — sparar en server-round-trip om länken
  // har lett till en uppenbart trasig URL.
  useEffect(() => {
    if (!token) setState("expired");
  }, [token]);

  async function handleCancel() {
    if (!token) return;
    setState("submitting");
    setError(null);
    try {
      // apiFetch hämtar/cachelagar CSRF-token även för anonyma users
      // → server-CSRF-middleware släpper igenom POST:en.
      const { ok, data, status } = await apiFetch<{
        ok?: boolean;
        error?: string;
      }>("/v1/auth/cancel-deletion", {
        method: "POST",
        body: { token },
      });
      if (ok && data?.ok) {
        setState("success");
        return;
      }
      if (status === 400) {
        setState("expired");
        return;
      }
      setError(data?.error ?? `Kunde inte avbryta (${status}).`);
      setState("error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
      setState("error");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Avbryt radering av ditt Roots-konto
          </h1>
          <p className="text-sm text-muted-foreground">
            Klicka på knappen nedan för att behålla ditt konto.
          </p>
        </div>

        {state === "success" && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            <p className="font-medium">Raderingen är avbruten.</p>
            <p className="mt-1">
              Du kan logga in som vanligt — allt är som vanligt.
            </p>
          </div>
        )}

        {state === "expired" && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-medium">Länken är inte längre giltig.</p>
            <p className="mt-1">
              Logga in på portalen och tryck på "Avbryt radering" där.
              Om kontot redan är raderat — kontakta{" "}
              <a className="underline" href="mailto:hej@roots.se">
                hej@roots.se
              </a>
              .
            </p>
          </div>
        )}

        {state === "error" && error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {state !== "success" && state !== "expired" && (
            <Button
              onClick={handleCancel}
              disabled={state === "submitting" || !token}
            >
              {state === "submitting" ? "Avbryter…" : "Behåll mitt konto"}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/login">Tillbaka till inloggning</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CancelDeletionPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Suspense
        fallback={
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-inverse-surface" />
          </div>
        }
      >
        <CancelDeletionInner />
      </Suspense>
    </main>
  );
}
