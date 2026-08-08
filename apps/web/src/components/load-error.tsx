"use client";

/**
 * Felläge när en sida inte kunde hämta sin data.
 *
 *   {error && <LoadError message={error} onRetry={load} />}
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { useLocale } from "@/i18n/locale-context";

interface Props {
  message: string;
  onRetry?: () => void;
  /** Kompaktare variant för när felet gäller en del av sidan. */
  inline?: boolean;
}

export function LoadError({ message, onRetry, inline = false }: Props) {
  const { locale } = useLocale();
  const retryLabel = appCommon[locale].retry;
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
          {retryLabel}
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
        {retryLabel}
      </Button>
    </div>
  );
}
