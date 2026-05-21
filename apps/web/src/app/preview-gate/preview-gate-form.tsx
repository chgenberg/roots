"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Mode = "password" | "waitlist";

export function PreviewGateForm() {
  const search = useSearchParams();
  const nextPath = search.get("next") || "/";
  const [mode, setMode] = useState<Mode>("password");

  return (
    <div>
      {/* Tabs are min 44px tall so Apple HIG tap-target rules are met
          on phones. Text bumped to text-[15px] for the same reason — the
          previous text-sm (14px) was inside the iOS auto-zoom trigger
          zone for nearby inputs. */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-brand-100/60 p-1 text-[15px]">
        <button
          type="button"
          onClick={() => setMode("password")}
          aria-pressed={mode === "password"}
          className={
            mode === "password"
              ? "rounded-full bg-background px-4 py-2.5 font-medium text-foreground shadow-sm"
              : "rounded-full px-4 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          Lösenord
        </button>
        <button
          type="button"
          onClick={() => setMode("waitlist")}
          aria-pressed={mode === "waitlist"}
          className={
            mode === "waitlist"
              ? "rounded-full bg-background px-4 py-2.5 font-medium text-foreground shadow-sm"
              : "rounded-full px-4 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          Få notis
        </button>
      </div>

      {mode === "password" ? (
        <PasswordForm nextPath={nextPath} />
      ) : (
        <WaitlistForm />
      )}
    </div>
  );
}

function PasswordForm({ nextPath }: { nextPath: string }) {
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
        // Cookie was set by the API on this response. A hard navigation
        // ensures the middleware re-evaluates the request with the new
        // cookie attached, so the user lands on the page they wanted.
        window.location.href = nextPath || "/";
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="preview-password"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Lösenord
        </label>
        <input
          id="preview-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // text-base = 16px to disable iOS Safari auto-zoom on focus.
          // h-11 (44px) hits the Apple HIG tap-target minimum.
          className="h-11 w-full rounded-lg border border-border bg-background px-4 text-base shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Ange lösenord"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-inverse-surface px-6 text-[15px] font-medium text-inverse-on-surface transition-colors hover:bg-inverse-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loggar in…" : "Lås upp"}
      </button>
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
      <div className="rounded-xl border border-border bg-brand-50 p-6 text-center">
        <p className="text-base font-medium text-foreground">
          {success.alreadyRegistered ? "Du finns redan på listan." : "Tack!"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vi hör av oss till {email} så fort vi lanserar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="waitlist-email"
          className="mb-2 block text-sm font-medium text-foreground"
        >
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
          className="h-11 w-full rounded-lg border border-border bg-background px-4 text-base shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="din@epost.se"
        />
      </div>

      <div>
        <label
          htmlFor="waitlist-name"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Namn <span className="text-muted-foreground">(valfritt)</span>
        </label>
        <input
          id="waitlist-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-background px-4 text-base shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="För- och efternamn"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-inverse-surface px-6 text-[15px] font-medium text-inverse-on-surface transition-colors hover:bg-inverse-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sparar…" : "Få notis vid lansering"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Vi använder din e-post för att höra av oss vid lansering. Inget skräp.
      </p>
    </form>
  );
}
