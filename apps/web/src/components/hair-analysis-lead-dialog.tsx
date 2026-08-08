"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  ChevronLeft,
  ShoppingBag,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";
import type { HairAnalysisCopy } from "@/i18n/dictionaries/hair-analysis";
import { LocaleLink } from "@/components/locale-link";

const STEPS = [
  "gate",
  "intro",
  "photo-back",
  "photo-top",
  "questions",
  "confirm",
  "loading",
  "result",
] as const;
type Step = (typeof STEPS)[number];

const VISIBLE_STEPS = STEPS.filter((s) => s !== "loading" && s !== "result");

const API_BASE = getBrowserApiBase();
const CONSENT_VERSION = "2026-04-02";

let _hairCsrf: string | null = null;
async function getHairCsrf(): Promise<string> {
  if (_hairCsrf) return _hairCsrf;
  const r = await rootsFetch(`${API_BASE}/v1/csrf-token`);
  const d = await r.json();
  _hairCsrf = d.token;
  return _hairCsrf!;
}
const SESSION_KEY = "roots_hair_wizard";
const SESSION_TTL_MS = 30 * 60 * 1000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("FILE_READ"));
    r.readAsDataURL(file);
  });
}

interface ParsedAnalysis {
  summary?: string;
  observationsFromImages?: string[];
  hairProfile?: { texture?: string; shine?: string; scalpNotes?: string };
  lifestyleTips?: string[];
  nutritionGeneralTips?: string[];
  rootsProductRecommendation?: {
    packageName?: string;
    description?: string;
  };
  rootsProductAngle?: string;
  disclaimer?: string;
}

interface WizardState {
  email: string;
  consent: boolean;
  newsletterConsent: boolean;
  washFrequency: string;
  heatTools: string;
  chemicalTreatment: string;
  swimFrequency: string;
  stressSleep: string;
  hairType: string;
  scalpCondition: string;
  notes: string;
  ts: number;
}

function loadDraft(): Partial<WizardState> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as WizardState;
    if (Date.now() - data.ts > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveDraft(state: Partial<WizardState>) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...state, ts: Date.now() })
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function optionLabel(
  options: Record<string, string>,
  value: string
): string {
  return options[value] ?? value;
}

function ProgressBar({
  current,
  t,
}: {
  current: Step;
  t: HairAnalysisCopy;
}) {
  const visibleIndex = VISIBLE_STEPS.indexOf(current as (typeof VISIBLE_STEPS)[number]);
  const idx = visibleIndex >= 0 ? visibleIndex : VISIBLE_STEPS.length;
  const total = VISIBLE_STEPS.length;
  const pct = current === "loading" || current === "result" ? 100 : ((idx) / (total - 1)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t.steps[current]}</span>
        {current !== "loading" && current !== "result" && (
          <span>
            {t.stepOf
              .replace("{current}", String(idx + 1))
              .replace("{total}", String(total))}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}

export function HairAnalysisLeadDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const { locale } = useLocale();
  const t = marketingUi[locale].hairAnalysis;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("gate");

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [newsletterConsent] = useState(true);

  const [backFile, setBackFile] = useState<File | null>(null);
  const [topFile, setTopFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [topPreview, setTopPreview] = useState<string | null>(null);

  const [washFrequency, setWashFrequency] = useState("varannan-dag");
  const [heatTools, setHeatTools] = useState("ibland");
  const [chemicalTreatment, setChemicalTreatment] = useState("ingen");
  const [swimFrequency, setSwimFrequency] = useState("nej");
  const [stressSleep, setStressSleep] = useState("3");
  const [hairType, setHairType] = useState("normalt");
  const [scalpCondition, setScalpCondition] = useState("normal");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedAnalysis | null>(null);
  // P3.40 (audit 2026-05-26): server returnerar `fallback: true` när
  // OpenAI är nere — vi måste signalera till användaren att svaret är
  // generiskt istället för att rendera det som en riktig analys.
  const [isFallback, setIsFallback] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const draft = loadDraft();
    if (draft) {
      if (draft.email) setEmail(draft.email);
      if (draft.consent) setConsent(draft.consent);
      /* newsletterConsent is always true — included in privacy policy */
      if (draft.washFrequency) setWashFrequency(draft.washFrequency);
      if (draft.heatTools) setHeatTools(draft.heatTools);
      if (draft.chemicalTreatment) setChemicalTreatment(draft.chemicalTreatment);
      if (draft.swimFrequency) setSwimFrequency(draft.swimFrequency);
      if (draft.stressSleep) setStressSleep(draft.stressSleep);
      if (draft.hairType) setHairType(draft.hairType);
      if (draft.scalpCondition) setScalpCondition(draft.scalpCondition);
      if (draft.notes) setNotes(draft.notes);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    saveDraft({
      email,
      consent,
      newsletterConsent,
      washFrequency,
      heatTools,
      chemicalTreatment,
      swimFrequency,
      stressSleep,
      hairType,
      scalpCondition,
      notes,
    });
  }, [
    open, email, consent, newsletterConsent,
    washFrequency, heatTools, chemicalTreatment, swimFrequency,
    stressSleep, hairType, scalpCondition, notes,
  ]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    return () => {
      if (backPreview) URL.revokeObjectURL(backPreview);
      if (topPreview) URL.revokeObjectURL(topPreview);
    };
  }, [backPreview, topPreview]);

  const reset = useCallback(() => {
    setStep("gate");
    setConsent(false);
    setBackFile(null);
    setTopFile(null);
    if (backPreview) URL.revokeObjectURL(backPreview);
    if (topPreview) URL.revokeObjectURL(topPreview);
    setBackPreview(null);
    setTopPreview(null);
    setError(null);
    setResultText(null);
    setParsed(null);
    setIsFallback(false);
    sessionStorage.removeItem(SESSION_KEY);
  }, [backPreview, topPreview]);

  const goBack = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1] as Step);
  }, [step]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const gateReady = isEmailValid && consent;

  function handlePhoto(
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (u: string | null) => void,
    oldPreview: string | null
  ) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError(t.errors.imageTooLarge);
      return;
    }
    setError(null);
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  // P3.13 (audit 2026-05-26): tidigare körde submitAnalysis() utan
  // AbortController — stänger användaren dialog:en mitt i en lång
  // Vision-request fortsatte fetchen leva och setState:ade på en
  // unmount:ad komponent. Vi sparar controllern i en ref så att
  // closing-handler kan abort:a den, och varje nytt försök får sin
  // egen controller.
  const submitAbortRef = useRef<AbortController | null>(null);

  async function submitAnalysis() {
    if (!backFile || !topFile || !consent || !email) return;
    setStep("loading");
    setLoading(true);
    setError(null);

    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      const [backData, topData] = await Promise.all([
        fileToDataUrl(backFile),
        fileToDataUrl(topFile),
      ]);

      const idempotencyKey = crypto.randomUUID();

      const csrf = await getHairCsrf();
      const res = await rootsFetch(`${API_BASE}/v1/ai/hair-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "x-csrf-token": csrf,
        },
        signal: controller.signal,
        body: JSON.stringify({
          consentAccepted: true,
          consentVersion: CONSENT_VERSION,
          email,
          newsletterConsent,
          ageConfirmed: true,
          locale,
          backImage: backData,
          topImage: topData,
          answers: {
            washFrequency,
            heatTools,
            chemicalTreatment,
            swimFrequency,
            stressSleep,
            hairType,
            scalpCondition,
            notes,
          },
        }),
      });

      if (controller.signal.aborted) return;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.errors.generic);
      }

      const raw = data.analysis as string;
      setResultText(raw);
      setIsFallback(Boolean(data.fallback));
      try {
        const j = JSON.parse(raw) as ParsedAnalysis;
        setParsed(j);
      } catch {
        setParsed(null);
      }
      setStep("result");
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      const message =
        e instanceof Error && e.message === "FILE_READ"
          ? t.errors.fileRead
          : e instanceof Error
            ? e.message
            : t.errors.analysisFailed;
      setError(message);
      setStep("confirm");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // P3.13: dialog stängd mitt i en pågående vision-request →
          // avbryt fetchen så vi inte fortsätter rendra i bakgrunden.
          submitAbortRef.current?.abort();
          // Pre-push fix 2026-05-26: finally-blocket i submitAnalysis
          // skippar setLoading(false) när signalen är aborted, vilket
          // gjorde att vi öppnade dialogen igen i evig spinner. Nolla
          // state explicit här så wizarden alltid är användbar nästa
          // gång användaren öppnar den.
          if (step === "loading") {
            setLoading(false);
            setStep("confirm");
          }
        }
        if (!o && step === "result") reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(92vh,860px)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        <div ref={contentRef} className="overflow-y-auto px-6 pb-6">
          <div className="mb-5 mt-4">
            <ProgressBar current={step} t={t} />
          </div>

          {step !== "gate" && step !== "loading" && step !== "result" && (
            <div className="mb-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={goBack}
              >
                <ChevronLeft className="h-4 w-4" />
                {t.back}
              </Button>
            </div>
          )}

          {/* STEG 1: E-post + godkännande */}
          {/* MASTERPLAN_01 KC6.8: wrap i <form> så att Enter i email-fältet
              triggar Fortsätt-knappen via native form-submit. Tidigare
              gjorde Enter ingenting → mobile-keyboarden visade "Go"-tangent
              som inte hade någon effekt. */}
          {step === "gate" && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (gateReady) setStep("intro");
              }}
              noValidate
            >
              <div className="grid gap-2">
                <Label htmlFor="gate-email">{t.gate.emailLabel}</Label>
                <Input
                  id="gate-email"
                  type="email"
                  placeholder={t.gate.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-brand-500"
                  aria-label={t.gate.consentAria}
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {t.gate.consentBefore}{" "}
                  <LocaleLink
                    href="/integritet"
                    target="_blank"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {t.gate.consentLink}
                  </LocaleLink>{" "}
                  {t.gate.consentAfter}
                </span>
              </label>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!gateReady}
              >
                {t.gate.continue}
              </Button>
            </form>
          )}

          {/* STEG 2: Intro */}
          {step === "intro" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t.intro.heading}</h3>
                <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">1</span>
                    <span>{t.intro.step1}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">2</span>
                    <span>{t.intro.step2}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">3</span>
                    <span>{t.intro.step3}</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs leading-relaxed text-brand-700">
                {t.intro.disclaimer}
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep("photo-back")}>
                {t.intro.cta}
              </Button>
            </div>
          )}

          {/* STEG 3: Foto bakifrån */}
          {step === "photo-back" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t.photoBack.heading}</h3>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">{t.photoBack.tipsTitle}</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>{t.photoBack.tip1}</li>
                  <li>{t.photoBack.tip2}</li>
                  <li>{t.photoBack.tip3}</li>
                </ol>
              </div>
              <label
                htmlFor="upload-back"
                className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:border-brand-300 hover:bg-muted/50"
              >
                <Camera className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {backFile ? t.photoBack.changePhoto : t.photoBack.choosePhoto}
                </span>
                <input
                  id="upload-back"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handlePhoto(e, setBackFile, setBackPreview, backPreview)}
                  aria-label={t.photoBack.uploadAria}
                />
              </label>
              {backPreview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={backPreview}
                    alt={t.photoBack.previewAlt}
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                size="lg"
                disabled={!backFile}
                onClick={() => { setError(null); setStep("photo-top"); }}
              >
                {t.photoBack.next}
              </Button>
            </div>
          )}

          {/* STEG 4: Foto uppifrån */}
          {step === "photo-top" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t.photoTop.heading}</h3>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">{t.photoTop.tipsTitle}</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>{t.photoTop.tip1}</li>
                  <li>{t.photoTop.tip2}</li>
                  <li>{t.photoTop.tip3}</li>
                </ol>
              </div>
              <label
                htmlFor="upload-top"
                className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:border-brand-300 hover:bg-muted/50"
              >
                <Camera className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {topFile ? t.photoTop.changePhoto : t.photoTop.choosePhoto}
                </span>
                <input
                  id="upload-top"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  className="sr-only"
                  onChange={(e) => handlePhoto(e, setTopFile, setTopPreview, topPreview)}
                  aria-label={t.photoTop.uploadAria}
                />
              </label>
              {topPreview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topPreview}
                    alt={t.photoTop.previewAlt}
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                size="lg"
                disabled={!topFile}
                onClick={() => { setError(null); setStep("questions"); }}
              >
                {t.photoTop.next}
              </Button>
            </div>
          )}

          {/* STEG 5: Frågeformulär */}
          {step === "questions" && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold">{t.questions.heading}</h3>

              <div className="grid gap-2">
                <Label>{t.questions.washLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={washFrequency}
                  onChange={(e) => setWashFrequency(e.target.value)}
                >
                  {(Object.keys(t.questions.washOptions) as Array<keyof typeof t.questions.washOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.washOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.hairTypeLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={hairType}
                  onChange={(e) => setHairType(e.target.value)}
                >
                  {(Object.keys(t.questions.hairTypeOptions) as Array<keyof typeof t.questions.hairTypeOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.hairTypeOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.scalpLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={scalpCondition}
                  onChange={(e) => setScalpCondition(e.target.value)}
                >
                  {(Object.keys(t.questions.scalpOptions) as Array<keyof typeof t.questions.scalpOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.scalpOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.heatLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={heatTools}
                  onChange={(e) => setHeatTools(e.target.value)}
                >
                  {(Object.keys(t.questions.heatOptions) as Array<keyof typeof t.questions.heatOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.heatOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.chemicalLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={chemicalTreatment}
                  onChange={(e) => setChemicalTreatment(e.target.value)}
                >
                  {(Object.keys(t.questions.chemicalOptions) as Array<keyof typeof t.questions.chemicalOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.chemicalOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.swimLabel}</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={swimFrequency}
                  onChange={(e) => setSwimFrequency(e.target.value)}
                >
                  {(Object.keys(t.questions.swimOptions) as Array<keyof typeof t.questions.swimOptions>).map((key) => (
                    <option key={key} value={key}>{t.questions.swimOptions[key]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t.questions.stressLabel}</Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={stressSleep}
                  onChange={(e) => setStressSleep(e.target.value)}
                  className="w-full accent-brand-500"
                  aria-label={t.questions.stressAria}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t.questions.stressLow}</span>
                  <span>{t.questions.stressLevel.replace("{level}", stressSleep)}</span>
                  <span>{t.questions.stressHigh}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">{t.questions.notesLabel}</Label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.questions.notesPlaceholder}
                  className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button className="w-full" size="lg" onClick={() => setStep("confirm")}>
                {t.questions.review}
              </Button>
            </div>
          )}

          {/* STEG 6: Bekräftelse */}
          {step === "confirm" && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold">{t.confirm.heading}</h3>
              <div className="grid grid-cols-2 gap-3">
                {backPreview && (
                  <div className="overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={backPreview} alt={t.confirm.backLabel} className="aspect-square w-full object-cover" />
                    <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">{t.confirm.backLabel}</p>
                  </div>
                )}
                {topPreview && (
                  <div className="overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={topPreview} alt={t.confirm.topLabel} className="aspect-square w-full object-cover" />
                    <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">{t.confirm.topLabel}</p>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p><span className="font-medium">{t.confirm.email}</span> {email}</p>
                <p>
                  <span className="font-medium">{t.confirm.hairType}</span>{" "}
                  {optionLabel(t.questions.hairTypeOptions, hairType)}
                </p>
                <p>
                  <span className="font-medium">{t.confirm.washFrequency}</span>{" "}
                  {optionLabel(t.questions.washOptions, washFrequency)}
                </p>
                <p>
                  <span className="font-medium">{t.confirm.scalp}</span>{" "}
                  {optionLabel(t.questions.scalpOptions, scalpCondition)}
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                size="lg"
                onClick={() => void submitAnalysis()}
                disabled={loading}
              >
                {t.confirm.start}
              </Button>
            </div>
          )}

          {/* STEG 7: Laddning */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
              <p className="mt-6 text-base font-semibold">{t.loading.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.loading.body}
              </p>
            </div>
          )}

          {/* STEG 8: Resultat */}
          {step === "result" && (
            <div className="space-y-6">
              {/* P3.40: tydlig flagga när servern skickade fallback istället
                  för en riktig vision-analys, så supportern inte tror det
                  är en personlig bedömning. */}
              {isFallback && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                >
                  <p className="font-semibold">{t.result.fallbackTitle}</p>
                  <p className="mt-1">
                    {t.result.fallbackBodyBefore}{" "}
                    <a
                      href="mailto:hej@roots.se"
                      className="underline underline-offset-2"
                    >
                      hej@roots.se
                    </a>{" "}
                    {t.result.fallbackBodyAfter}
                  </p>
                </div>
              )}
              {parsed ? (
                <>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
                    <div>
                      <h3 className="text-lg font-semibold">
                        {isFallback
                          ? t.result.titleFallback
                          : t.result.titleReady}
                      </h3>
                      <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                        {parsed.summary}
                      </p>
                    </div>
                  </div>

                  {parsed.hairProfile && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.result.profileTexture}</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.texture}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.result.profileShine}</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.shine}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.result.profileScalp}</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.scalpNotes}</p>
                      </div>
                    </div>
                  )}

                  {parsed.observationsFromImages && parsed.observationsFromImages.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {t.result.observations}
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {parsed.observationsFromImages.map((o, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Separator />

                  {parsed.lifestyleTips && parsed.lifestyleTips.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {t.result.lifestyle}
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {parsed.lifestyleTips.map((o, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsed.nutritionGeneralTips && parsed.nutritionGeneralTips.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {t.result.nutrition}
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {parsed.nutritionGeneralTips.map((o, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Separator />

                  {(parsed.rootsProductRecommendation || parsed.rootsProductAngle) && (
                    <div className="rounded-2xl border border-foreground/10 bg-foreground p-6 text-background">
                      <p className="text-xs font-medium uppercase tracking-widest opacity-70">
                        {t.result.packageLabel}
                      </p>
                      <h4 className="mt-1 text-xl font-bold">
                        {parsed.rootsProductRecommendation?.packageName || t.result.packageFallback}
                      </h4>
                      <p className="mt-3 text-sm leading-relaxed opacity-90">
                        {parsed.rootsProductRecommendation?.description || parsed.rootsProductAngle}
                      </p>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" size="lg" className="gap-2" asChild>
                          <LocaleLink href="/produkter">
                            <ShoppingBag className="h-4 w-4" />
                            {t.result.seeProducts}
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="lg" className="gap-2 border-background/20 text-background hover:bg-background/10" asChild>
                          <LocaleLink href="/foreningsliv">
                            <Phone className="h-4 w-4" />
                            {t.result.bookCall}
                          </LocaleLink>
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {parsed.disclaimer || t.result.disclaimerFallback}{" "}
                    <LocaleLink href="/integritet" className="underline underline-offset-2 hover:text-brand-500">
                      {t.result.privacyMore}
                    </LocaleLink>
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
                    <h3 className="text-lg font-semibold">{t.result.titleReady}</h3>
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                    {resultText}
                  </pre>
                </div>
              )}
              <Button variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                {t.result.close}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
