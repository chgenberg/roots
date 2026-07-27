"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Lock } from "lucide-react";
import { apiFetch } from "@/lib/api";

/**
 * The gate asks for two different things from two different audiences, so
 * it leads with one and tucks the other away: visitors leave an email,
 * while the handful of people with the password reveal that field on
 * demand. Two equal-weight tabs made the email capture — the whole point
 * of the gate — compete with a field almost nobody can fill in.
 */

const FIELD_CLASS =
  // 16px text avoids iOS Safari's auto-zoom on focus; h-12 clears the
  // 44px minimum tap target.
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-base " +
  "transition-colors placeholder:text-muted-foreground/70 " +
  "focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

const PRIMARY_BTN_CLASS =
  "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full " +
  "bg-inverse-surface px-6 text-[15px] font-medium text-inverse-on-surface " +
  "transition-all hover:bg-inverse-surface-hover active:scale-[0.99] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

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
  const search = useSearchParams();
  const nextParam = search.get("next");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <WaitlistForm />

      <div className="mt-7 border-t border-border pt-5">
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
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="h-3 w-3" aria-hidden />
            Jag har ett lösenord
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordForm({ nextParam }: { nextParam: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Ange lösenord.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ ok?: boolean; error?: string }>(
        "/v1/preview/unlock",
        { method: "POST", body: { password } }
      );
      if (res.ok) {
        // The API set the cookie on this response. A hard navigation makes
        // the middleware re-evaluate with the cookie attached, so the user
        // lands on the page they originally asked for.
        window.location.href = resolveNextPath(nextParam);
        return;
      }
      setError(res.data?.error || "Fel lösenord.");
    } catch {
      setError("Kunde inte ansluta. Försök igen.");
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
        Lösenord för förhandsvisning
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
          aria-label="Lås upp"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-inverse-surface px-4 text-inverse-on-surface transition-colors hover:bg-inverse-surface-hover disabled:opacity-60"
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

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ alreadyRegistered: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError("Ange en e-postadress.");
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
        body: { email, name: name || undefined },
      });
      if (res.ok) {
        setSuccess({ alreadyRegistered: !!res.data?.alreadyRegistered });
        return;
      }
      setError(res.data?.error || "Kunde inte spara just nu.");
    } catch {
      setError("Kunde inte ansluta. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        role="status"
        className="animate-fade-in rounded-2xl border border-border bg-brand-50 px-5 py-6 text-center"
      >
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-base font-medium">
          {success.alreadyRegistered ? "Du står redan på listan" : "Tack!"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Vi hör av oss till <span className="text-foreground">{email}</span> så
          fort vi lanserar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="waitlist-email" className="sr-only">
          E-post
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD_CLASS}
          placeholder="din@epost.se"
        />
      </div>

      <div>
        <label htmlFor="waitlist-name" className="sr-only">
          Namn (valfritt)
        </label>
        <input
          id="waitlist-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD_CLASS}
          placeholder="Namn (valfritt)"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className={PRIMARY_BTN_CLASS}>
        {loading ? "Sparar…" : "Meddela mig vid lansering"}
        {!loading && (
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Ett mejl när vi lanserar. Inget skräp, ingen vidareförsäljning.
      </p>
    </form>
  );
}
