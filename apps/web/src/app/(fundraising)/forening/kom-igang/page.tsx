"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

type StepId =
  | "approval"
  | "org_details"
  | "campaign"
  | "team"
  | "team_leader"
  | "first_sale";

interface OnboardingStep {
  id: StepId;
  label: string;
  description: string;
  completed: boolean;
  ctaHref: string;
  ctaLabel: string;
}

interface OnboardingStatus {
  orgId: string;
  orgName: string;
  orgApproved?: boolean;
  completed: boolean;
  completedCount: number;
  totalSteps: number;
  steps: OnboardingStep[];
}

function localizeStep(
  step: OnboardingStep,
  t: (typeof fundraisingPages.getStarted)["sv"]
): OnboardingStep {
  const map: Record<
    StepId,
    { label: string; descDone: string; descTodo: string; ctaDone: string; ctaTodo: string }
  > = {
    approval: {
      label: t.step_approval_label,
      descDone: t.step_approval_desc_done,
      descTodo: t.step_approval_desc_todo,
      ctaDone: t.step_approval_cta_done,
      ctaTodo: t.step_approval_cta_todo,
    },
    org_details: {
      label: t.step_org_details_label,
      descDone: t.step_org_details_desc,
      descTodo: t.step_org_details_desc,
      ctaDone: t.step_org_details_cta_done,
      ctaTodo: t.step_org_details_cta_todo,
    },
    campaign: {
      label: t.step_campaign_label,
      descDone: t.step_campaign_desc,
      descTodo: t.step_campaign_desc,
      ctaDone: t.step_campaign_cta_done,
      ctaTodo: t.step_campaign_cta_todo,
    },
    team: {
      label: t.step_team_label,
      descDone: t.step_team_desc,
      descTodo: t.step_team_desc,
      ctaDone: t.step_team_cta_done,
      ctaTodo: t.step_team_cta_todo,
    },
    team_leader: {
      label: t.step_team_leader_label,
      descDone: t.step_team_leader_desc,
      descTodo: t.step_team_leader_desc,
      ctaDone: t.step_team_leader_cta_done,
      ctaTodo: t.step_team_leader_cta_todo,
    },
    first_sale: {
      label: t.step_first_sale_label,
      descDone: t.step_first_sale_desc,
      descTodo: t.step_first_sale_desc,
      ctaDone: t.step_first_sale_cta_done,
      ctaTodo: t.step_first_sale_cta_todo,
    },
  };
  const copy = map[step.id];
  if (!copy) return step;
  return {
    ...step,
    label: copy.label,
    description: step.completed ? copy.descDone : copy.descTodo,
    ctaLabel: step.completed ? copy.ctaDone : copy.ctaTodo,
  };
}

function KomIgangInner() {
  const params = useSearchParams();
  const { locale } = useLocale();
  const t = fundraisingPages.getStarted[locale];
  const c = fundraisingPages.common[locale];
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
      setError(
        data?.error ?? tFill(t.loadFailed, { status: httpStatus })
      );
      setLoading(false);
      return;
    }
    setStatus(data as OnboardingStatus);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {error ?? c.somethingWrong}
        </CardContent>
      </Card>
    );
  }

  const progress = Math.round(
    (status.completedCount / status.totalSteps) * 100
  );
  const steps = status.steps.map((step) => localizeStep(step, t));

  return (
    <div className="page-enter space-y-6">
      <header className="space-y-2">
        {isFreshSignup && (
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            {t.welcomeBadge}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {isFreshSignup
            ? tFill(t.welcomeTitle, { name: status.orgName })
            : t.title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {status.completed ? t.completedBody : t.introBody}
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {tFill(t.progressOf, {
                done: status.completedCount,
                total: status.totalSteps,
              })}
            </span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-brand-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.progressAria}
          >
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <ol className="space-y-3" aria-label={t.checklistAria}>
        {steps.map((step, index) => (
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
                      {tFill(t.stepLabel, { n: index + 1 })}
                    </p>
                    {step.completed && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        {t.doneBadge}
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
                  <LocaleLink href={step.ctaHref}>
                    {step.ctaLabel}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </LocaleLink>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t.footerHint}{" "}
          <LocaleLink href="/forening/kom-igang" className="underline">
            /forening/kom-igang
          </LocaleLink>
          .
        </p>
        <Button asChild variant="ghost" size="sm">
          <LocaleLink href="/forening">
            {status.completed ? t.toDashboard : t.skipDashboard}
          </LocaleLink>
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
