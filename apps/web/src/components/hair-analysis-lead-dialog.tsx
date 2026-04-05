"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

const STEP_LABELS: Record<Step, string> = {
  gate: "Kom igång",
  intro: "Vad du får",
  "photo-back": "Foto bakifrån",
  "photo-top": "Foto uppifrån",
  questions: "Dina vanor",
  confirm: "Skicka",
  loading: "Analyserar",
  result: "Resultat",
};

const VISIBLE_STEPS = STEPS.filter((s) => s !== "loading" && s !== "result");

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CONSENT_VERSION = "2026-04-02";
const SESSION_KEY = "roots_hair_wizard";
const SESSION_TTL_MS = 30 * 60 * 1000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Kunde inte läsa filen"));
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

function ProgressBar({ current, steps }: { current: Step; steps: readonly Step[] }) {
  const visibleIndex = VISIBLE_STEPS.indexOf(current as (typeof VISIBLE_STEPS)[number]);
  const idx = visibleIndex >= 0 ? visibleIndex : VISIBLE_STEPS.length;
  const total = VISIBLE_STEPS.length;
  const pct = current === "loading" || current === "result" ? 100 : ((idx) / (total - 1)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{STEP_LABELS[current]}</span>
        {current !== "loading" && current !== "result" && (
          <span>
            {idx + 1} av {total}
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
      setError("Bilden får vara max 4 MB. Prova en mindre fil eller JPEG-format.");
      return;
    }
    setError(null);
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submitAnalysis() {
    if (!backFile || !topFile || !consent || !email) return;
    setStep("loading");
    setLoading(true);
    setError(null);

    try {
      const [backData, topData] = await Promise.all([
        fileToDataUrl(backFile),
        fileToDataUrl(topFile),
      ]);

      const idempotencyKey = crypto.randomUUID();

      const res = await fetch(`${API_BASE}/v1/ai/hair-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          consentAccepted: true,
          consentVersion: CONSENT_VERSION,
          email,
          newsletterConsent,
          ageConfirmed: true,
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Något gick fel");
      }

      const raw = data.analysis as string;
      setResultText(raw);
      try {
        const j = JSON.parse(raw) as ParsedAnalysis;
        setParsed(j);
      } catch {
        setParsed(null);
      }
      setStep("result");
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vi kunde inte slutföra analysen just nu. Försök igen.");
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && step === "result") reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(92vh,860px)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Håranalys
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Två bilder och några frågor — personligt resultat på under 2 minuter.
          </DialogDescription>
        </DialogHeader>

        <div ref={contentRef} className="overflow-y-auto px-6 pb-6">
          <div className="mb-5 mt-4">
            <ProgressBar current={step} steps={STEPS} />
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
                Tillbaka
              </Button>
            </div>
          )}

          {/* STEG 1: E-post + godkännande */}
          {step === "gate" && (
            <div className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="gate-email">E-postadress</Label>
                <Input
                  id="gate-email"
                  type="email"
                  placeholder="namn@exempel.se"
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
                  aria-label="Godkänn integritetspolicy"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Jag godkänner{" "}
                  <a href="/integritetspolicy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                    integritetspolicyn
                  </a>
                  {" "}och att mina bilder analyseras av AI. Resultatet är vägledande.
                </span>
              </label>

              <Button
                className="w-full"
                size="lg"
                disabled={!gateReady}
                onClick={() => setStep("intro")}
              >
                Fortsätt
              </Button>
            </div>
          )}

          {/* STEG 2: Intro */}
          {step === "intro" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Så här fungerar det</h3>
                <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">1</span>
                    <span>Du laddar upp två bilder på ditt hår — bakifrån och uppifrån.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">2</span>
                    <span>Du svarar på några korta frågor om dina vanor.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">3</span>
                    <span>Vår AI analyserar bilderna och ger dig en personlig bedömning med livsstils-, kost- och produktrekommendationer.</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs leading-relaxed text-brand-700">
                Indikativ analys — ersätter inte professionell vård. Vid ihållande
                besvär, kontakta en legitimerad hudläkare.
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep("photo-back")}>
                Börja med första fotot
              </Button>
            </div>
          )}

          {/* STEG 3: Foto bakifrån */}
          {step === "photo-back" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Foto bakifrån</h3>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Tips för bästa resultat:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Jämnt ljus — undvik direkt blixt som bleker håret.</li>
                  <li>Håll kameran ca 30 cm från huvudet.</li>
                  <li>Torrt hår utan styling ger tydligast bild.</li>
                </ol>
              </div>
              <label
                htmlFor="upload-back"
                className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:border-brand-300 hover:bg-muted/50"
              >
                <Camera className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {backFile ? "Byt bild" : "Välj bild eller ta foto"}
                </span>
                <input
                  id="upload-back"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handlePhoto(e, setBackFile, setBackPreview, backPreview)}
                  aria-label="Ladda upp foto av hår bakifrån"
                />
              </label>
              {backPreview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={backPreview}
                    alt="Förhandsvisning bakifrån"
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
                Nästa: foto uppifrån
              </Button>
            </div>
          )}

          {/* STEG 4: Foto uppifrån */}
          {step === "photo-top" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Foto uppifrån</h3>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Tips:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Fotografera rakt uppifrån så hjässan och hårstrån syns.</li>
                  <li>Samma ljusförhållanden som föregående bild.</li>
                  <li>Inget filter — naturlig bild ger bäst analys.</li>
                </ol>
              </div>
              <label
                htmlFor="upload-top"
                className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:border-brand-300 hover:bg-muted/50"
              >
                <Camera className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {topFile ? "Byt bild" : "Välj bild eller ta foto"}
                </span>
                <input
                  id="upload-top"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  className="sr-only"
                  onChange={(e) => handlePhoto(e, setTopFile, setTopPreview, topPreview)}
                  aria-label="Ladda upp foto av hår uppifrån"
                />
              </label>
              {topPreview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topPreview}
                    alt="Förhandsvisning uppifrån"
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
                Nästa: några frågor
              </Button>
            </div>
          )}

          {/* STEG 5: Frågeformulär */}
          {step === "questions" && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold">Berätta om dina vanor</h3>

              <div className="grid gap-2">
                <Label>Hur ofta tvättar du håret?</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={washFrequency}
                  onChange={(e) => setWashFrequency(e.target.value)}
                >
                  <option value="dagligen">Dagligen</option>
                  <option value="varannan-dag">Varannan dag</option>
                  <option value="2-3">2–3 gånger per vecka</option>
                  <option value="sallan">Sällan</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Hur beskriver du ditt hår?</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={hairType}
                  onChange={(e) => setHairType(e.target.value)}
                >
                  <option value="torrt">Torrt</option>
                  <option value="normalt">Normalt</option>
                  <option value="fett">Fett / oljigt</option>
                  <option value="blandat">Blandat (fett vid rötterna, torrt i längderna)</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Hårbotten</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={scalpCondition}
                  onChange={(e) => setScalpCondition(e.target.value)}
                >
                  <option value="normal">Inga besvär</option>
                  <option value="torr">Torr / stram</option>
                  <option value="fett">Fet / oljig</option>
                  <option value="kliar">Kliar ibland</option>
                  <option value="flagnar">Flagnar / mjäll</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Värmeverktyg</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={heatTools}
                  onChange={(e) => setHeatTools(e.target.value)}
                >
                  <option value="aldrig">Aldrig</option>
                  <option value="ibland">Ibland</option>
                  <option value="ofta">Ofta</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Kemisk behandling</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={chemicalTreatment}
                  onChange={(e) => setChemicalTreatment(e.target.value)}
                >
                  <option value="ingen">Ingen</option>
                  <option value="farg">Färg</option>
                  <option value="blek">Blekning</option>
                  <option value="permanent">Permanent</option>
                  <option value="annat">Annat / flera</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Simmar du i klor- eller saltvatten?</Label>
                <select
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={swimFrequency}
                  onChange={(e) => setSwimFrequency(e.target.value)}
                >
                  <option value="nej">Nej / sällan</option>
                  <option value="ibland">Ibland (någon gång i månaden)</option>
                  <option value="regelbundet">Regelbundet (varje vecka)</option>
                  <option value="dagligen">Nästan dagligen</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Stress och sömn (1 = låg stress, bra sömn — 5 = hög stress, dålig sömn)</Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={stressSleep}
                  onChange={(e) => setStressSleep(e.target.value)}
                  className="w-full accent-brand-500"
                  aria-label="Stressnivå och sömnkvalitet"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 — Lugnt</span>
                  <span>Nivå {stressSleep}</span>
                  <span>5 — Stressat</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Övrigt (valfritt)</Label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="T.ex. kliar hårbotten, mycket tovor, nyligen bytt schampo"
                  className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button className="w-full" size="lg" onClick={() => setStep("confirm")}>
                Granska och skicka
              </Button>
            </div>
          )}

          {/* STEG 6: Bekräftelse */}
          {step === "confirm" && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold">Redo att analysera</h3>
              <div className="grid grid-cols-2 gap-3">
                {backPreview && (
                  <div className="overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={backPreview} alt="Bakifrån" className="aspect-square w-full object-cover" />
                    <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">Bakifrån</p>
                  </div>
                )}
                {topPreview && (
                  <div className="overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={topPreview} alt="Uppifrån" className="aspect-square w-full object-cover" />
                    <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">Uppifrån</p>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p><span className="font-medium">E-post:</span> {email}</p>
                <p><span className="font-medium">Hårtyp:</span> {hairType}</p>
                <p><span className="font-medium">Tvättfrekvens:</span> {washFrequency}</p>
                <p><span className="font-medium">Hårbotten:</span> {scalpCondition}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                size="lg"
                onClick={() => void submitAnalysis()}
                disabled={loading}
              >
                Starta analysen
              </Button>
            </div>
          )}

          {/* STEG 7: Laddning */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
              <p className="mt-6 text-base font-semibold">Analyserar…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tar vanligtvis 10–30 sekunder.
              </p>
            </div>
          )}

          {/* STEG 8: Resultat */}
          {step === "result" && (
            <div className="space-y-6">
              {parsed ? (
                <>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Din håranalys är klar</h3>
                      <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                        {parsed.summary}
                      </p>
                    </div>
                  </div>

                  {parsed.hairProfile && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Struktur</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.texture}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Glans</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.shine}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-brand-50/40 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hårbotten</p>
                        <p className="mt-1 text-sm font-semibold">{parsed.hairProfile.scalpNotes}</p>
                      </div>
                    </div>
                  )}

                  {parsed.observationsFromImages && parsed.observationsFromImages.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Observationer från bilderna
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
                        Livsstilstips
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
                        Kost (allmänna råd)
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
                        Rekommenderat paket
                      </p>
                      <h4 className="mt-1 text-xl font-bold">
                        {parsed.rootsProductRecommendation?.packageName || "Roots Complete Kit"}
                      </h4>
                      <p className="mt-3 text-sm leading-relaxed opacity-90">
                        {parsed.rootsProductRecommendation?.description || parsed.rootsProductAngle}
                      </p>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" size="lg" className="gap-2" asChild>
                          <a href="/produkter">
                            <ShoppingBag className="h-4 w-4" />
                            Se produkterna
                          </a>
                        </Button>
                        <Button variant="outline" size="lg" className="gap-2 border-background/20 text-background hover:bg-background/10" asChild>
                          <a href="/foreningsliv">
                            <Phone className="h-4 w-4" />
                            Boka samtal
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {parsed.disclaimer || "Indikativ analys — ersätter inte professionell vård."}{" "}
                    <a href="/integritetspolicy" className="underline underline-offset-2 hover:text-brand-500">
                      Läs mer om hur vi hanterar dina uppgifter.
                    </a>
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
                    <h3 className="text-lg font-semibold">Din håranalys är klar</h3>
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                    {resultText}
                  </pre>
                </div>
              )}
              <Button variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                Stäng
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
