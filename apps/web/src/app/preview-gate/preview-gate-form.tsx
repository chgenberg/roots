"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Lock } from "lucide-react";
import {
  INTEREST_CUSTOMER_TYPES,
  normalizeInterestPhone,
  type InterestCustomerType,
  type InterestIntent,
} from "@roots/contracts";
import { apiFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { preview } from "@/i18n/dictionaries/preview";
import { useLocale } from "@/i18n/locale-context";

/**
 * The gate asks for two different things from two different audiences, so
 * it leads with one and tucks the other away: clubs, teams and schools send
 * an interest form, while the handful of people with the password reveal
 * that field on demand.
 */

const FIELD_CLASS =
  // 16px text avoids iOS Safari's auto-zoom on focus; h-12 clears the
  // 44px minimum tap target.
  "h-12 w-full min-w-0 rounded-full border border-border bg-background px-5 text-base " +
  "transition-colors placeholder:text-muted-foreground " +
  "focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

const SUBMIT_BTN_CLASS =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-8 " +
  "text-sm font-semibold uppercase tracking-[0.08em] text-white transition-all " +
  "hover:bg-brand-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const TYPE_LABEL_KEY = {
  forening: "typeForening",
  lag: "typeLag",
  grundskola: "typeGrundskola",
  gymnasium: "typeGymnasium",
} as const satisfies Record<InterestCustomerType, keyof (typeof preview)["sv"]>;

/**
 * Where to send the visitor once they unlock.
 *
 * The middleware *rewrites* to /preview-gate rather than redirecting, so the
 * address bar still shows the page the visitor asked for while the `next`
 * query param lives only on the internal URL — `useSearchParams()` never
 * sees it. The browser's own pathname is therefore the reliable signal, and
 * the param is only a fallback for someone opening /preview-gate directly.
 *
 * Only same-origin absolute paths are accepted; a protocol-relative "//evil"
 * would otherwise turn the unlock into an open redirect.
 */
function resolveNextPath(param: string | null): string {
  if (typeof window !== "undefined") {
    const { pathname, search } = window.location;
    if (!pathname.startsWith("/preview-gate")) return pathname + search;
  }
  if (param && param.startsWith("/") && !param.startsWith("//")) return param;
  return "/";
}

export function PreviewGateForm() {
  const { locale } = useLocale();
  const t = preview[locale];
  const search = useSearchParams();
  const nextParam = search.get("next");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <InterestForm />

      <div className="mt-8 border-t border-border pt-5">
        {showPassword ? (
          <div className="animate-slide-down">
            <PasswordForm nextParam={nextParam} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            aria-expanded={false}
            aria-controls="preview-password-panel"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="h-3 w-3" aria-hidden />
            {t.havePassword}
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordForm({ nextParam }: { nextParam: string | null }) {
  const { locale } = useLocale();
  const t = preview[locale];
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(t.errorPasswordRequired);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ ok?: boolean; error?: string }>(
        "/v1/preview/unlock",
        { method: "POST", body: { password, locale } }
      );
      if (res.ok) {
        // The API set the cookie on this response. A hard navigation makes
        // the middleware re-evaluate with the cookie attached, so the user
        // lands on the page they originally asked for.
        window.location.href = resolveNextPath(nextParam);
        return;
      }
      setError(res.data?.error || t.errorWrongPassword);
    } catch {
      setError(t.errorConnect);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      id="preview-password-panel"
      onSubmit={onSubmit}
      className="space-y-3"
    >
      <label
        htmlFor="preview-password"
        className="block text-xs font-medium text-muted-foreground"
      >
        {t.passwordLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="preview-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD_CLASS}
          placeholder="••••••••"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label={t.unlockAria}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function InterestForm() {
  const { locale } = useLocale();
  const t = preview[locale];
  const [intent, setIntent] = useState<InterestIntent>("start");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<InterestCustomerType | "">("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ alreadyRegistered: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!phone.trim()) return t.phoneRequired;
    if (!normalizeInterestPhone(phone)) return t.phoneInvalid;
    if (!email.trim()) return t.emailRequired;
    if (!customerType) return t.customerTypeRequired;
    if (!consent) return t.consentRequired;
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{
        ok?: boolean;
        alreadyRegistered?: boolean;
        error?: string;
      }>("/v1/preview/waitlist", {
        method: "POST",
        body: { email, phone, customerType, intent, consent, locale },
      });
      if (res.ok) {
        setSuccess({ alreadyRegistered: !!res.data?.alreadyRegistered });
        return;
      }
      setError(res.data?.error || t.waitlistError);
    } catch {
      setError(t.errorConnect);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        role="status"
        className="animate-fade-in rounded-3xl border border-border bg-brand-50 px-6 py-7"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-medium">
          {success.alreadyRegistered ? t.alreadyOnList : t.thankYou}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.weWillContact} <span className="text-foreground">{phone.trim()}</span>{" "}
          {t.or} <span className="text-foreground">{email.trim()}</span>.
        </p>
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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t.contactHeading}</h2>

        <div>
          <label htmlFor="interest-phone" className="sr-only">
            {t.phoneLabel}
          </label>
          <input
            id="interest-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            aria-required="true"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={FIELD_CLASS}
            placeholder={`${t.phoneLabel}*`}
          />
        </div>

        <div>
          <label htmlFor="interest-email" className="sr-only">
            {t.emailLabel}
          </label>
          <input
            id="interest-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-required="true"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_CLASS}
            placeholder={`${t.emailLabel}*`}
          />
        </div>

        <div className="relative pt-2">
          <label
            htmlFor="interest-type"
            className="absolute left-4 top-0 z-10 bg-background px-1 text-xs text-muted-foreground"
          >
            {t.customerTypeLabel}*
          </label>
          <select
            id="interest-type"
            name="customerType"
            required
            aria-required="true"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as InterestCustomerType | "")}
            className={`${FIELD_CLASS} appearance-none pr-12 ${customerType ? "" : "text-muted-foreground"}`}
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
          <ChevronDown
            className="pointer-events-none absolute right-5 top-[calc(50%+4px)] h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
          aria-required="true"
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

      <button type="submit" disabled={loading} className={SUBMIT_BTN_CLASS}>
        {loading ? t.sending : t.submit}
      </button>
    </form>
  );
}
