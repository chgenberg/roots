"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CalculatorInputs, CalculatorResult } from "@roots/contracts";
import { RevenueCalculator } from "@/components/calculator/revenue-calculator";
import { RootsLogo } from "@/components/brand";
import { LocaleLink } from "@/components/locale-link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { pages } from "@/i18n/dictionaries/pages";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";
import { CheckCircle2, Sparkles } from "lucide-react";

interface CalcData {
  associationName: string;
  presets: CalculatorInputs | null;
  products: { name: string; priceOre: number }[];
}

export default function PublicCalculatorPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const { locale } = useLocale();
  const t = pages.kalkylatorShare[locale];

  const [data, setData] = useState<CalcData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound">(
    "loading"
  );

  const [inputs, setInputs] = useState<CalculatorInputs | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCalcChange = useCallback(
    (next: CalculatorInputs, _result: CalculatorResult) => {
      setInputs(next);
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { ok, data: body, status: code } = await apiFetch<CalcData>(
        `/v1/calculator/by-token/${token}`
      );
      if (cancelled) return;
      if (ok) {
        setData(body);
        setStatus("ok");
      } else {
        setStatus(code === 404 ? "notfound" : "notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!inputs) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t.errorInvalidEmail);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { ok, data: body } = await apiFetch<{ error?: string }>(
        `/v1/calculator/by-token/${token}/lead`,
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
        setError(body?.error || t.errorGeneric);
      }
    } catch {
      setError(t.errorGeneric);
    } finally {
      setSending(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-inverse-surface" />
      </div>
    );
  }

  if (status === "notfound" || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <RootsLogo variant="auto" className="mb-6 h-8 w-20" />
        <h1 className="text-xl font-bold">{t.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.notFoundBody}</p>
        <Button asChild className="mt-6" variant="secondary">
          <LocaleLink href="/foreningsliv">{t.readMore}</LocaleLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex flex-col items-start gap-4">
        <RootsLogo variant="auto" className="h-7 w-[70px]" />
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
            <Sparkles className="h-4 w-4" />
            {tFill(t.badge, { name: data.associationName })}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {tFill(t.title, { name: data.associationName })}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t.body}</p>
        </div>
      </header>

      <RevenueCalculator
        defaultInputs={data.presets ?? undefined}
        products={data.products}
        onChange={onCalcChange}
      />

      <Card className="mt-10 border-brand-200">
        <CardContent className="p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-brand-600" />
              <h2 className="text-xl font-bold">{t.thanksTitle}</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {t.thanksBody}
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold">{t.leadTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.leadBody}</p>
              <form
                onSubmit={submitLead}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">{t.emailLabel}</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">{t.nameLabel}</Label>
                  <Input
                    id="lead-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lead-msg">{t.messageLabel}</Label>
                  <Input
                    id="lead-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.messagePlaceholder}
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
                    {t.consentBefore}
                    <LocaleLink
                      href="/integritet"
                      className="underline underline-offset-2"
                    >
                      {t.privacyLink}
                    </LocaleLink>
                    {t.consentAfter}
                  </span>
                </label>
                {error && (
                  <p className="text-sm text-destructive sm:col-span-2">
                    {error}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={sending} size="lg">
                    {sending ? t.submitting : t.submit}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
