"use client";

/**
 * Felläge när en sida inte kunde hämta sin data.
 *
 * Fanns tidigare inklistrat ordagrant i ett halvdussin sidor, medan ett
 * annat halvdussin svalde felet med `.catch(() => {})` och renderade en tom
 * lista. Det senare är det farliga: en intäktssida som visar 0 kr när
 * anropet misslyckats ser ut som ett svar, inte som ett fel, och det finns
 * inget i gränssnittet som avslöjar skillnaden.
 *
 *   {error && <LoadError message={error} onRetry={load} />}
 *
 * Utan `onRetry` laddas sidan om, vilket är rätt när hämtningen sker i en
 * effekt som inte går att anropa igen utifrån. Med `onRetry` behåller vi
 * filter och annat sidtillstånd, så föredra den varianten.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onRetry?: () => void;
  /** Kompaktare variant för när felet gäller en del av sidan. */
  inline?: boolean;
}

export function LoadError({ message, onRetry, inline = false }: Props) {
  const retry = onRetry ?? (() => window.location.reload());

  if (inline) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={retry}>
          Försök igen
        </Button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-20"
    >
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="max-w-md text-center text-sm text-destructive">{message}</p>
      <Button variant="outline" onClick={retry}>
        Försök igen
      </Button>
    </div>
  );
}
