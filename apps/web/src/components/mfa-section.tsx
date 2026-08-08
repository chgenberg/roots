"use client";

/**
 * Registrering och avstängning av tvåfaktorsautentisering.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/i18n/locale-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

interface MfaStatus {
  enabled: boolean;
  required: boolean;
  enabledAt?: string | null;
  backupCodesRemaining: number;
  demo?: boolean;
}

export function MfaSection() {
  const { locale } = useLocale();
  const t = portalPages.mfa[locale];
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [rebinding, setRebinding] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiFetch<MfaStatus>("/v1/auth/mfa");
    if (ok && data) setStatus(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!setupUri) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    import("qrcode")
      .then((qrcode) =>
        qrcode.toDataURL(setupUri, { width: 360, margin: 1 })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setupUri]);

  async function startSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await apiFetch<{
      error?: string;
      secret?: string;
      uri?: string;
    }>("/v1/auth/mfa/setup", {
      method: "POST",
      body: status?.enabled ? { password, code } : { password },
    });
    setBusy(false);
    if (!ok || !data?.uri) {
      toast(data?.error ?? t.startFail, "error");
      return;
    }
    setSetupUri(data.uri);
    setSetupSecret(data.secret ?? null);
    setPassword("");
    setCode("");
    void load();
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await apiFetch<{
      error?: string;
      backupCodes?: string[];
    }>("/v1/auth/mfa/enable", { method: "POST", body: { code } });
    setBusy(false);
    if (!ok || !data?.backupCodes) {
      toast(data?.error ?? t.codeMismatch, "error");
      setCode("");
      return;
    }
    setFreshCodes(data.backupCodes);
    setSetupUri(null);
    setSetupSecret(null);
    setCode("");
    setRebinding(false);
    void load();
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.loading}
      </div>
    );
  }

  if (status.demo) {
    return (
      <p className="text-sm text-muted-foreground">{t.demoLocked}</p>
    );
  }

  if (freshCodes) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <p className="text-sm font-medium">{t.enabled}</p>
        </div>
        <div className="rounded-lg border border-warning-edge bg-warning-surface p-4">
          <p className="text-sm font-medium text-warning-strong">
            {t.saveCodesTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.saveCodesBody}</p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm">
            {freshCodes.map((c) => (
              <li key={c} className="tabular-nums">
                {c}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(freshCodes.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast(t.copyFail, "error");
              }
            }}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? t.copied : t.copyCodes}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFreshCodes(null)}>
          {t.codesSaved}
        </Button>
      </div>
    );
  }

  if (status.enabled && !setupUri) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <p className="text-sm font-medium">{t.enabled}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.enabledBody}
          {status.backupCodesRemaining > 0
            ? tFill(t.backupRemaining, {
                count: status.backupCodesRemaining,
              })
            : t.backupNone}
        </p>
        {status.required && (
          <p className="text-xs text-muted-foreground">{t.roleRequired}</p>
        )}

        {rebinding ? (
          <form onSubmit={startSetup} className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">{t.rebindIntro}</p>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-rebind-password">{t.password}</Label>
              <Input
                id="mfa-rebind-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-rebind-code">{t.currentCode}</Label>
              <Input
                id="mfa-rebind-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy || !password || !code}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.continue}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRebinding(false);
                  setPassword("");
                  setCode("");
                }}
              >
                {t.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRebinding(true)}
          >
            {t.switchApp}
          </Button>
        )}
      </div>
    );
  }

  if (setupUri) {
    return (
      <form onSubmit={confirmSetup} className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.scanIntro}</p>
        <div className="flex flex-wrap items-start gap-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={t.qrAlt}
              width={180}
              height={180}
              className="rounded-lg border bg-white p-2"
            />
          ) : (
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-lg border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {setupSecret && (
            <div className="space-y-1">
              <p className="text-xs font-medium">{t.manualKey}</p>
              <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                {setupSecret}
              </code>
            </div>
          )}
        </div>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="mfa-confirm">{t.appCode}</Label>
          <Input
            id="mfa-confirm"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.activate}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSetupUri(null);
              setSetupSecret(null);
              setCode("");
            }}
          >
            {t.cancel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={startSetup} className="space-y-4">
      {status.required ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-edge bg-warning-surface p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
          <p className="text-sm text-warning-strong">{t.roleRequiredBanner}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.enableIntro}</p>
      )}

      <div className="max-w-xs space-y-2">
        <Label htmlFor="mfa-password">{t.confirmPassword}</Label>
        <Input
          id="mfa-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="mr-2 h-4 w-4" />
        )}
        {t.getStarted}
      </Button>
    </form>
  );
}
