"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculatorInputs, CalculatorResult } from "@roots/contracts";
import { RevenueCalculator } from "@/components/calculator/revenue-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleLink } from "@/components/locale-link";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import { pages } from "@/i18n/dictionaries/pages";
import { ArrowRight, CheckCircle2, Sparkles, Play } from "lucide-react";

type SaCopy = (typeof pages.saFungerarDet)[Locale];
type DemoStep = SaCopy["steps"][number];

const STEP_MEDIA: Record<string, { video: string; poster: string }> = {
  forening: { video: "/demo/forening.mp4", poster: "/demo/forening-poster.jpg" },
  lag: { video: "/demo/lag.mp4", poster: "/demo/lag-poster.jpg" },
  seller: { video: "/demo/seller.mp4", poster: "/demo/seller-poster.jpg" },
};

function PhoneFilm({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[300px]", className)}>
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-brand-100/50 blur-2xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-[2rem] border border-border/60 shadow-[var(--shadow-card)]">
        <video
          className="aspect-[9/16] w-full bg-brand-50 object-cover"
          poster={poster}
          src={src}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
      </div>
    </div>
  );
}

function DemoFilms({
  steps,
  roleTablistLabel,
}: {
  steps: readonly DemoStep[];
  roleTablistLabel: string;
}) {
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const step = steps[active];
  const media = STEP_MEDIA[step.id] ?? STEP_MEDIA.forening;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {
      /* autoplay kan blockeras — posters visas då */
    });
  }, [active]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="order-2 lg:order-1">
        <div className="relative mx-auto w-full max-w-[320px]">
          <div
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-brand-100/50 blur-2xl"
            aria-hidden="true"
          />
          <div className="overflow-hidden rounded-[2rem] border border-border/60 shadow-[var(--shadow-card)]">
            <video
              ref={videoRef}
              key={step.id}
              className="aspect-[9/16] w-full bg-brand-50 object-cover"
              poster={media.poster}
              src={media.video}
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
            />
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-2">
        <div
          role="tablist"
          aria-label={roleTablistLabel}
          className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-background/60 p-1"
        >
          {steps.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active
                  ? "bg-brand-900 text-brand-50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.tab}
            </button>
          ))}
        </div>

        <div className="mt-8 page-enter" key={step.id}>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
            <Play className="h-3.5 w-3.5 fill-current" />
            {step.eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {step.title}
          </h3>
          <p className="mt-3 max-w-md text-muted-foreground">
            {step.description}
          </p>
          <ul className="mt-6 space-y-3">
            {step.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CalculatorBlock({ copy }: { copy: SaCopy }) {
  const [inputs, setInputs] = useState<CalculatorInputs | null>(null);
  const [products, setProducts] = useState<
    { name: string; priceOre: number }[]
  >([]);
  const [presets, setPresets] = useState<Partial<CalculatorInputs> | undefined>(
    undefined
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await apiFetch<{
        presets: CalculatorInputs;
        products: { name: string; priceOre: number }[];
      }>("/v1/calculator/public");
      if (cancelled || !ok) return;
      setProducts(data.products ?? []);
      setPresets(data.presets);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCalcChange = useCallback(
    (next: CalculatorInputs, _result: CalculatorResult) => {
      setInputs(next);
    },
    []
  );

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!inputs) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(copy.leadErrorInvalidEmail);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/calculator/public/lead",
        {
          method: "POST",
          body: {
            email: email.trim(),
            contactName: name.trim() || undefined,
            message: message.trim() || undefined,
            newsletterConsent: consent,
            inputs,
          },
        }
      );
      if (ok) {
        setSent(true);
      } else {
        setError(data?.error || copy.leadErrorGeneric);
      }
    } catch {
      setError(copy.leadErrorGeneric);
    } finally {
      setSending(false);
    }
  }

  const linkWord = copy.leadConsentPrivacyLink;
  const consentIdx = copy.leadConsent.indexOf(linkWord);

  return (
    <>
      <RevenueCalculator
        defaultInputs={presets}
        products={products}
        onChange={onCalcChange}
      />

      <Card className="mt-10 border-brand-200">
        <CardContent className="p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-brand-600" />
              <h3 className="text-xl font-bold">{copy.leadThanksTitle}</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                {copy.leadThanksBody}
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold">{copy.leadTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.leadBody}
              </p>
              <form
                onSubmit={submitLead}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">{copy.leadEmailLabel}</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={copy.leadEmailPlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">{copy.leadNameLabel}</Label>
                  <Input
                    id="lead-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={copy.leadNamePlaceholder}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lead-msg">{copy.leadMessageLabel}</Label>
                  <Input
                    id="lead-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={copy.leadMessagePlaceholder}
                    maxLength={2000}
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#6B794F]"
                  />
                  <span>
                    {consentIdx === -1 ? (
                      copy.leadConsent
                    ) : (
                      <>
                        {copy.leadConsent.slice(0, consentIdx)}
                        <LocaleLink
                          href="/integritet"
                          className="underline underline-offset-2"
                        >
                          {linkWord}
                        </LocaleLink>
                        {copy.leadConsent.slice(consentIdx + linkWord.length)}
                      </>
                    )}
                  </span>
                </label>
                {error && (
                  <p className="text-sm text-destructive sm:col-span-2">
                    {error}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={sending} size="lg">
                    {sending ? copy.leadSubmitting : copy.leadSubmit}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function SaFungerarDetClient() {
  const { locale } = useLocale();
  const t = pages.saFungerarDet[locale];

  return (
    <>
      <section className="relative overflow-hidden bg-brand-50/40 py-20 md:py-28">
        <div
          className="pointer-events-none absolute -top-16 right-[8%] h-48 w-48 rounded-full border border-brand-200/30 animate-float motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[760px] px-6 text-center md:px-10">
          <Badge variant="secondary" className="mb-4">
            {t.badge}
          </Badge>
          <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.05] tracking-tight">
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t.heroBody}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <a href="#rakna">
                {t.ctaCalc}
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <LocaleLink href="/kontakt?intent=demo">{t.ctaDemo}</LocaleLink>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <Sparkles className="h-4 w-4" />
              {t.demoEyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {t.demoTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.demoSubtitle}</p>
          </div>
          <DemoFilms steps={t.steps} roleTablistLabel={t.roleTablistLabel} />
        </div>
      </section>

      <section id="rakna" className="scroll-mt-24 bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="mb-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <PhoneFilm
                src="/demo/kalkylator.mp4"
                poster="/demo/kalkylator-poster.jpg"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                <Sparkles className="h-4 w-4" />
                {t.calcEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {t.calcTitle}
              </h2>
              <p className="mt-3 max-w-md text-muted-foreground">{t.calcBody}</p>
              <ul className="mt-6 space-y-3">
                {t.calcBullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                {t.calcTryBelow}
                <ArrowRight className="h-4 w-4" />
              </p>
            </div>
          </div>
          <CalculatorBlock copy={t} />
        </div>
      </section>
    </>
  );
}
