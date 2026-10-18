"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import {
  INTEREST_CUSTOMER_TYPES,
  normalizeInterestPhone,
  type InterestCustomerType,
  type InterestIntent,
} from "@roots/contracts";
import { apiFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { readStoredTracking, readTrackingFromLocation } from "@/components/utm-capture";
import { interest } from "@/i18n/dictionaries/interest";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

/**
 * Intresseanmälan i tre steg. Steg 1 sparar anmälan direkt så att ingen
 * lead går förlorad om besökaren stänger fliken; steg 2 är frivilligt och
 * gör anmälan till en lead i säljpipelinen.
 */

type Dict = Record<keyof (typeof interest)["sv"], string>;
type Step = 1 | 2 | 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT_EMAIL_KEY = "roots_interest_email";

const FIELD_CLASS =
  // 16px text avoids iOS Safari's auto-zoom on focus; h-12 clears the
  // 44px minimum tap target.
  "peer h-12 w-full min-w-0 rounded-full border bg-background px-5 pr-11 text-base " +
  "transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

const FLOAT_LABEL_CLASS =
  "pointer-events-none absolute left-4 top-0 z-10 -translate-y-1/2 bg-background px-1 text-xs " +
  "text-muted-foreground transition-all duration-150 " +
  "peer-placeholder-shown:left-5 peer-placeholder-shown:top-1/2 peer-placeholder-shown:bg-transparent " +
  "peer-placeholder-shown:px-0 peer-placeholder-shown:text-base " +
  "peer-focus:left-4 peer-focus:top-0 peer-focus:bg-background peer-focus:px-1 peer-focus:text-xs";

const PRIMARY_BTN_CLASS =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-8 " +
  "text-sm font-semibold uppercase tracking-[0.08em] text-white transition-all " +
  "hover:bg-brand-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto";

const TYPE_LABEL_KEY = {
  forening: "typeForening",
  lag: "typeLag",
  grundskola: "typeGrundskola",
  gymnasium: "typeGymnasium",
} as const satisfies Record<InterestCustomerType, keyof Dict>;

function FloatingField({
  id,
  label,
  valid,
  error,
  ...input
}: {
  id: string;
  label: string;
  valid: boolean;
  error?: string | null;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(FIELD_CLASS, error ? "border-destructive" : "border-border")}
          {...input}
        />
        <label htmlFor={id} className={FLOAT_LABEL_CLASS}>
          {label}*
        </label>
        {valid && (
          <Check
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-success"
            aria-hidden
          />
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 px-5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function StepIndicator({ step, t }: { step: Step; t: Dict }) {
  const labels = [t.step1, t.step2, t.step3];
  return (
    <ol
      aria-label={tFill(t.stepsLabel, { step })}
      className="mb-7 flex items-center gap-2 text-xs text-muted-foreground"
    >
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-brand-700 bg-brand-700 text-white",
                current && "border-foreground text-foreground",
                !done && !current && "border-border"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span className={cn("hidden sm:inline", current && "font-medium text-foreground")}>
              {label}
            </span>
            {n < 3 && <span className="h-px w-5 bg-border sm:w-8" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function InterestFlow({ gated = false }: { gated?: boolean }) {
  const { locale } = useLocale();
  const t = interest[locale];
  const [step, setStep] = useState<Step>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 1) return;
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

  return (
    <div ref={topRef} className="scroll-mt-28">
      <StepIndicator step={step} t={t} />
      {step === 1 && (
        <InterestForm
          t={t}
          onSent={(id) => {
            setLeadId(id);
            setStep(id ? 2 : 3);
          }}
        />
      )}
      {step === 2 && leadId && (
        <CompleteForm
          t={t}
          leadId={leadId}
          onDone={(wasSkipped) => {
            setSkipped(wasSkipped);
            setStep(3);
          }}
        />
      )}
      {step === 3 && <Done t={t} gated={gated} skipped={skipped} />}
    </div>
  );
}

function InterestForm({ t, onSent }: { t: Dict; onSent: (id: string | null) => void }) {
  const { locale } = useLocale();
  const [intent, setIntent] = useState<InterestIntent>("start");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<InterestCustomerType | "">("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState({ phone: false, email: false });
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneOk = normalizeInterestPhone(phone) !== null;
  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = phoneOk && emailOk && customerType !== "" && consent && !loading;

  async function send() {
    setDuplicate(false);
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ ok?: boolean; id?: string | null; error?: string }>(
        "/v1/preview/waitlist",
        {
          method: "POST",
          body: {
            email,
            phone,
            customerType,
            intent,
            consent,
            website,
            locale,
            tracking: { ...readStoredTracking(), ...readTrackingFromLocation() },
          },
        }
      );
      if (res.ok) {
        try {
          sessionStorage.setItem(SENT_EMAIL_KEY, email.trim().toLowerCase());
        } catch {
          // Utan sessionStorage blir det bara ingen dubblettfråga.
        }
        onSent(res.data?.id ?? null);
        return;
      }
      setError(res.data?.error || t.sendError);
    } catch {
      setError(t.connectError);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      if (sessionStorage.getItem(SENT_EMAIL_KEY) === email.trim().toLowerCase()) {
        setDuplicate(true);
        return;
      }
    } catch {
      // Ingen sessionStorage: skicka direkt.
    }
    void send();
  }

  if (duplicate) {
    return (
      <div role="alertdialog" aria-labelledby="interest-dup-title" className="animate-fade-in rounded-3xl border border-border px-6 py-7">
        <h2 id="interest-dup-title" className="text-lg font-semibold tracking-tight">
          {t.duplicateHeading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {tFill(t.duplicateText, { email: email.trim() })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void send()} disabled={loading} className={PRIMARY_BTN_CLASS}>
            {loading ? t.sending : t.duplicateYes}
          </button>
          <button
            type="button"
            onClick={() => setDuplicate(false)}
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-medium transition-colors hover:border-foreground"
          >
            {t.duplicateNo}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset className="space-y-2.5">
        <legend className="sr-only">{t.intentLegend}</legend>
        {(
          [
            ["start", t.intentStart],
            ["info", t.intentInfo],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-3 text-[15px]">
            <input
              type="radio"
              name="intent"
              value={value}
              checked={intent === value}
              onChange={() => setIntent(value)}
              className="h-[18px] w-[18px] shrink-0 accent-brand-700"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{t.contactHeading}</h2>

        <FloatingField
          id="interest-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          required
          label={t.phoneLabel}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
          valid={phoneOk}
          error={touched.phone && phone.trim() && !phoneOk ? t.phoneInvalid : null}
        />

        <FloatingField
          id="interest-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          label={t.emailLabel}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((s) => ({ ...s, email: true }))}
          valid={emailOk}
          error={touched.email && email.trim() && !emailOk ? t.emailInvalid : null}
        />

        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="relative">
          <label
            htmlFor="interest-type"
            className="absolute left-4 top-0 z-10 -translate-y-1/2 bg-background px-1 text-xs text-muted-foreground"
          >
            {t.customerTypeLabel}*
          </label>
          <select
            id="interest-type"
            name="customerType"
            required
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as InterestCustomerType | "")}
            className={cn(
              "h-12 w-full min-w-0 appearance-none rounded-full border border-border bg-background px-5 pr-12 text-base",
              "transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20",
              !customerType && "text-muted-foreground"
            )}
          >
            <option value="" disabled>
              {t.customerTypePlaceholder}
            </option>
            {INTEREST_CUSTOMER_TYPES.map((type) => (
              <option key={type} value={type} className="text-foreground">
                {t[TYPE_LABEL_KEY[type]]}
              </option>
            ))}
          </select>
          {customerType ? (
            <Check
              className="pointer-events-none absolute right-11 top-1/2 h-4 w-4 -translate-y-1/2 text-success"
              aria-hidden
            />
          ) : null}
          <ChevronDown
            className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-brand-700"
        />
        <span>
          {t.consentBefore}{" "}
          <LocaleLink
            href="/integritet"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-muted-foreground"
          >
            {t.consentLink}
          </LocaleLink>
          {t.consentAfter}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={PRIMARY_BTN_CLASS}>
        {loading ? t.sending : t.submit}
      </button>
    </form>
  );
}

function CompleteForm({
  t,
  leadId,
  onDone,
}: {
  t: Dict;
  leadId: string;
  onDone: (skipped: boolean) => void;
}) {
  const { locale } = useLocale();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organisation, setOrganisation] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("forening") ?? "").trim().slice(0, 120)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    firstName.trim() !== "" && lastName.trim() !== "" && organisation.trim().length >= 2 && !loading;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ ok?: boolean; error?: string }>("/v1/preview/waitlist/complete", {
        method: "POST",
        body: { id: leadId, firstName, lastName, organisation, locale },
      });
      if (res.ok) {
        onDone(false);
        return;
      }
      setError(res.data?.error || t.sendError);
    } catch {
      setError(t.connectError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.completeHeading}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.completeText}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingField
            id="interest-first-name"
            name="firstName"
            autoComplete="given-name"
            maxLength={120}
            required
            label={t.firstNameLabel}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            valid={firstName.trim() !== ""}
          />
          <FloatingField
            id="interest-last-name"
            name="lastName"
            autoComplete="family-name"
            maxLength={120}
            required
            label={t.lastNameLabel}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            valid={lastName.trim() !== ""}
          />
        </div>
        <FloatingField
          id="interest-organisation"
          name="organisation"
          autoComplete="organization"
          maxLength={255}
          required
          label={t.organisationLabel}
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          valid={organisation.trim().length >= 2}
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <button type="submit" disabled={!canSubmit} className={PRIMARY_BTN_CLASS}>
            {loading ? t.completeSending : t.completeSubmit}
          </button>
          <button
            type="button"
            onClick={() => onDone(true)}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t.skip}
          </button>
        </div>
      </form>
    </div>
  );
}

function Done({ t, gated, skipped }: { t: Dict; gated: boolean; skipped: boolean }) {
  return (
    <div role="status" className="animate-fade-in rounded-3xl border border-border bg-brand-50 px-6 py-8">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        {skipped ? t.doneHeadingSkipped : t.doneHeading}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {gated ? t.doneTextGated : t.doneTextFull}
      </p>
      {!gated && (
        <div className="mt-6 flex flex-wrap gap-3">
          <LocaleLink
            href="/sa-fungerar-det#rakna"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-800"
          >
            {t.doneCalc}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LocaleLink>
          <LocaleLink
            href="/sa-fungerar-det"
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-foreground"
          >
            {t.doneHow}
          </LocaleLink>
        </div>
      )}
    </div>
  );
}
