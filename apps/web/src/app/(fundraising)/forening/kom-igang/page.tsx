"use client";

/**
 * MASTERPLAN_01 KC3.1 — Kom-igång (onboarding-wizard) för ASSOCIATION_ADMIN.
 *
 * Designval:
 *   - Inte en modal — sidan ÄR ändpunkten efter signup. Användare ska
 *     kunna bookmarka /forening/kom-igang och få samma vy.
 *   - Checklist är driven av `GET /v1/association/onboarding-status`
 *     så vi har en SSOT (single source of truth) som även dashboard-
 *     bannern kan läsa. Ändrar vi kriterier centralt fortsätter UI:t
 *     spegla server-state utan duplicate-logic.
 *   - Inga inline-formulär här — vi länkar till befintliga sidor som
 *     redan vet hur de skapar kampanjer, lag, fyller i uppgifter.
 *     Bra för konsistens (en plats per action) och för att inte ha en
 *     halv-implementation av varje wizard-step.
 *   - "Hoppa över"-länk = `/forening` direkt. Användaren tvingas inte
 *     genomföra checklistan — bara nudgad. När `completed` blir true
 *     döljer vi bannern på dashboard:en helt.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id:
    | "approval"
    | "org_details"
    | "campaign"
    | "team"
    | "team_leader"
    | "first_sale";
  label: string;
  description: string;
  completed: boolean;
  ctaHref: string;
  ctaLabel: string;
}

interface OnboardingStatus {
  orgId: string;
  orgName: string;
  /** Godkänd för publik försäljning. Se lib/org-approval.ts i API:t. */
  orgApproved?: boolean;
  completed: boolean;
  completedCount: number;
  totalSteps: number;
  steps: OnboardingStep[];
}

function KomIgangInner() {
  const params = useSearchParams();
  const isFreshSignup = params.get("onboarding") === "1";
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { ok, data, status: httpStatus } = await apiFetch<
      OnboardingStatus & { error?: string }
    >("/v1/association/onboarding-status");
    if (!ok) {
      setError(data?.error ?? `Kunde inte hämta status (${httpStatus}).`);
      setLoading(false);
      return;
    }
    setStatus(data as OnboardingStatus);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Refresha när tab:en blir aktiv igen — låter användaren göra en
  // step i en annan tab (t.ex. fylla i org-nr i inställningar) och se
  // checklist:en bockas av direkt vid byte tillbaka.
  useEffect(() => {
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive" role="alert">
          {error ?? "Något gick fel."}
        </CardContent>
      </Card>
    );
  }

  const progress = Math.round(
    (status.completedCount / status.totalSteps) * 100
  );

  return (
    <div className="page-enter space-y-6">
      <header className="space-y-2">
        {isFreshSignup && (
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            Välkommen till Roots
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {isFreshSignup
            ? `Roligt att ha er ombord, ${status.orgName}!`
            : "Kom igång med Roots"}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {status.completed
            ? "Allt på checklistan är klart — föreningen är igång!"
            : "Sex snabba steg så är ni redo att sälja. Hoppa runt i vilken ordning ni vill."}
        </p>
      </header>

      {/* Progress-bar — visar både siffra och visuell fyllning */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {status.completedCount} av {status.totalSteps} klara
            </span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-brand-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Onboarding-progress"
          >
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <ol className="space-y-3" aria-label="Onboarding-checklista">
        {status.steps.map((step, index) => (
          <li key={step.id}>
            <Card
              className={cn(
                "transition-shadow hover:shadow-md",
                step.completed && "bg-emerald-50/50"
              )}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Steg {index + 1}
                    </p>
                    {step.completed && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        Klart
                      </span>
                    )}
                  </div>
                  <h2
                    className={cn(
                      "text-base font-semibold sm:text-lg",
                      step.completed && "text-emerald-900"
                    )}
                  >
                    {step.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant={step.completed ? "outline" : "default"}
                  className="shrink-0"
                >
                  <Link href={step.ctaHref}>
                    {step.ctaLabel}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Det här fönstret syns tills allt är klart. Du hittar alltid checklistan
          på <Link href="/forening/kom-igang" className="underline">/forening/kom-igang</Link>.
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/forening">
            {status.completed ? "Till dashboard" : "Hoppa till dashboard"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function KomIgangPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <KomIgangInner />
    </Suspense>
  );
}
