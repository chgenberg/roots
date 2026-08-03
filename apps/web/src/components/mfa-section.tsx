"use client";

/**
 * Registrering och avstängning av tvåfaktor.
 *
 * Egen komponent eftersom flödet har fyra lägen (av, påbörjad, nyss
 * aktiverad med koder att skriva ner, aktiverad) och inställningssidan är
 * lång nog som den är.
 *
 * Reservkoderna visas en enda gång, direkt efter aktiveringen. Att kunna
 * hämta dem igen senare skulle göra dem lika användbara för någon med en
 * kapad session som för användaren själv.
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

interface MfaStatus {
  enabled: boolean;
  required: boolean;
  enabledAt?: string | null;
  backupCodesRemaining: number;
  demo?: boolean;
}

export function MfaSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Registreringsflödet
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

  // Biblioteket är ~50 kB och behövs bara av den handfull användare som
  // faktiskt registrerar en app, så det laddas när QR-koden ska visas.
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
        // Nyckeln visas i klartext vid sidan om, så en trasig QR-kod
        // blockerar inte registreringen.
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setupUri]);

  async function startSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Vid byte av app skickas även en kod från den nuvarande appen. Utan den
    // skulle lösenordet räcka för att flytta andra faktorn till en annan
    // enhet, och en kapad session vore lika bra som att äga kontot.
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
      toast(data?.error ?? "Kunde inte starta registreringen.", "error");
      return;
    }
    setSetupUri(data.uri);
    setSetupSecret(data.secret ?? null);
    setPassword("");
    setCode("");
    // Bytet nollställde aktiveringen i backend — statusen ska följa med, så
    // formuläret nedan inte fortsätter kräva en kod från den gamla appen.
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
      toast(data?.error ?? "Koden stämmer inte.", "error");
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
        Hämtar status för tvåfaktor…
      </div>
    );
  }

  if (status.demo) {
    return (
      <p className="text-sm text-muted-foreground">
        Tvåfaktor går inte att ändra i demoläget.
      </p>
    );
  }

  // Reservkoderna, direkt efter aktivering. Enda gången de visas.
  if (freshCodes) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <p className="text-sm font-medium">Tvåfaktor är aktiverad</p>
        </div>
        <div className="rounded-lg border border-warning-edge bg-warning-surface p-4">
          <p className="text-sm font-medium text-warning-strong">
            Spara dina reservkoder nu
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Var och en fungerar en gång, om du inte har telefonen. Du kan inte
            hämta dem igen senare — då får du registrera appen på nytt.
          </p>
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
                toast("Kunde inte kopiera. Markera och kopiera manuellt.", "error");
              }
            }}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Kopierat" : "Kopiera koderna"}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFreshCodes(null)}>
          Jag har sparat dem
        </Button>
      </div>
    );
  }

  // Prövas före `status.enabled`: ett appbyte nollställer aktiveringen i
  // backend, och status hinner släpa efter ett ögonblick. Annars försvann
  // QR-koden under användaren mitt i bytet.
  if (status.enabled && !setupUri) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <p className="text-sm font-medium">Tvåfaktor är aktiverad</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Du anger en kod från din autentiseringsapp varje gång du loggar in.
          {status.backupCodesRemaining > 0
            ? ` Du har ${status.backupCodesRemaining} reservkoder kvar.`
            : " Du har inga reservkoder kvar — byt app nedan för att få nya."}
        </p>
        {status.required && (
          <p className="text-xs text-muted-foreground">
            Din roll kräver tvåfaktor, så den kan inte stängas av.
          </p>
        )}

        {/* Bytet kräver båda faktorerna, så en kapad session inte kan flytta
            andra faktorn till en angripares telefon. Har du tappat appen och
            är utan reservkoder kan bara vi återställa den — hör av dig. */}
        {rebinding ? (
          <form onSubmit={startSetup} className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Ange ditt lösenord och en kod från appen du använder nu. Sedan
              får du en ny QR-kod att skanna. Den gamla appen slutar gälla
              direkt.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-rebind-password">Lösenord</Label>
              <Input
                id="mfa-rebind-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-rebind-code">
                Kod från nuvarande app (eller en reservkod)
              </Label>
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
                Fortsätt
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
                Avbryt
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRebinding(true)}
          >
            Byt till en ny app
          </Button>
        )}
      </div>
    );
  }

  // Steg 2: appen är tillagd, koden ska bekräftas.
  if (setupUri) {
    return (
      <form onSubmit={confirmSetup} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Skanna koden med Google Authenticator, 1Password, Authy eller en
          annan app. Ange sedan den sexsiffriga koden appen visar.
        </p>
        <div className="flex flex-wrap items-start gap-4">
          {/* QR-koden ritas lokalt. otpauth-URI:n innehåller hemligheten, så
              den får aldrig gå till en extern bildtjänst. */}
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR-kod för att registrera tvåfaktor"
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
              <p className="text-xs font-medium">
                Kan du inte skanna? Skriv in nyckeln:
              </p>
              <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                {setupSecret}
              </code>
            </div>
          )}
        </div>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="mfa-confirm">Kod från appen</Label>
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
            Aktivera tvåfaktor
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
            Avbryt
          </Button>
        </div>
      </form>
    );
  }

  // Steg 1: av. Lösenordet krävs igen så att en kapad session inte kan
  // byta ut andra faktorn mot angriparens egen app.
  return (
    <form onSubmit={startSetup} className="space-y-4">
      {status.required ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-edge bg-warning-surface p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
          <p className="text-sm text-warning-strong">
            Din roll ser data för alla föreningar, så tvåfaktor krävs. Fram
            till att du registrerat en app är portalen låst.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Lägg till en kod från en autentiseringsapp vid inloggning. Då räcker
          det inte med ditt lösenord för att komma in på kontot.
        </p>
      )}

      <div className="max-w-xs space-y-2">
        <Label htmlFor="mfa-password">Bekräfta med ditt lösenord</Label>
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
        Kom igång
      </Button>
    </form>
  );
}