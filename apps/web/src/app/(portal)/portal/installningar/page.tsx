"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePortalUser } from "@/lib/portal-context";
import { Shield, Bell, Palette, AlertTriangle, KeyRound } from "lucide-react";
import { MfaSection } from "@/components/mfa-section";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { broadcastLogout } from "@/lib/use-cross-tab-logout";

function getRoleMeta(role: string) {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER")
    return { label: "Förening", description: "Föreningsmedlem med tillgång till klubbportalen.", color: "bg-brand-50 text-brand-600" };
  if (role === "SALES_REP" || role === "SALES_ADMIN")
    return { label: "Säljare", description: "Säljrepresentant med tillgång till säljportalen.", color: "bg-brand-50 text-brand-600" };
  return { label: "Admin", description: "Intern administratör med full åtkomst.", color: "bg-brand-50 text-brand-600" };
}

// ── Byt lösenord-dialog (Sprint C) ────────────────────────────────
// Three text fields (current / new / confirm). Calls
// `POST /v1/auth/change-password`, which verifies the current password
// against argon2 and writes the new hash. The current session keeps
// working so the user doesn't get logged out mid-flow.
function BytLosenordDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setCurrent("");
    setNext("");
    setConfirmNext("");
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    if (!current || !next) {
      setError("Båda lösenordsfält krävs.");
      return;
    }
    if (next.length < 8) {
      setError("Nytt lösenord måste vara minst 8 tecken.");
      return;
    }
    if (next !== confirmNext) {
      setError("Bekräftelsen matchar inte det nya lösenordet.");
      return;
    }
    if (next === current) {
      setError("Nytt lösenord får inte vara samma som det gamla.");
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data, status } = await apiFetch<{ error?: string }>(
        "/v1/auth/change-password",
        {
          method: "POST",
          body: { currentPassword: current, newPassword: next },
        }
      );
      if (!ok) {
        setError(
          data?.error ||
            (status === 401
              ? "Fel nuvarande lösenord."
              : `Kunde inte byta lösenord (${status}).`)
        );
        return;
      }
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte byta lösenord.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Byt lösenord</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="pwd-current">Nuvarande lösenord</Label>
            <Input
              id="pwd-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-new">Nytt lösenord (minst 8 tecken)</Label>
            <Input
              id="pwd-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-confirm">Bekräfta nytt lösenord</Label>
            <Input
              id="pwd-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmNext}
              onChange={(e) => setConfirmNext(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sparar…" : "Spara nytt lösenord"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Radera konto-dialog (KC2.7) ───────────────────────────────────
// Triggar `POST /v1/auth/delete-account` med password + bekräftelse-ord.
// Loopen är två-stegs medvetet:
//   1. Användaren skriver "RADERA" och sitt lösenord
//   2. Server sätter scheduled_deletion_at = now+14d, anonymiserar
//      sessions, skickar bekräftelse-mail
// Vi loggar ut användaren omedelbart efter ok-svar (sessionen finns
// inte längre i Redis ändå). Inom 14d kan användaren ångra via
// /konto/avbryt-radering?token=... från mailen.
function RaderaKontoDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Lösenord krävs.");
      return;
    }
    if (confirm !== "RADERA") {
      setError('Skriv ordet "RADERA" i bekräftelse-fältet.');
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data, status } = await apiFetch<{
        error?: string;
        scheduledDeletionAt?: string;
        cooldownDays?: number;
      }>("/v1/auth/delete-account", {
        method: "POST",
        body: { password, confirm },
      });
      if (!ok) {
        setError(
          data?.error ||
            (status === 401
              ? "Fel lösenord."
              : `Kunde inte skicka begäran (${status}).`)
        );
        return;
      }
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka begäran.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Radera ditt konto
          </DialogTitle>
        </DialogHeader>
        {/* KC6.8-mönstret: form-wrapper så Enter triggar submit */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-2">
            <div className="rounded-lg bg-warning-surface p-3 text-xs text-warning-strong">
              <p className="font-medium">Det här går att ångra inom 14 dagar.</p>
              <p className="mt-1 text-warning-strong/80">
                Efter 14 dagar anonymiseras dina personliga uppgifter
                permanent. Beställningar och fakturor sparas anonymiserat
                i 7 år som bokföringslagen kräver.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="del-password">Lösenord</Label>
              <Input
                id="del-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="del-confirm">
                Skriv <span className="font-mono">RADERA</span> för att bekräfta
              </Label>
              <Input
                id="del-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="RADERA"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="px-6 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting || confirm !== "RADERA"}
            >
              {submitting ? "Skickar…" : "Radera kontot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeletionStatus {
  status: "none" | "scheduled" | "deleted" | "unknown";
  scheduledDeletionAt?: string;
  requestedAt?: string;
}

export default function InstallningarPage() {
  const user = usePortalUser();
  const router = useRouter();
  const { toast } = useToast();
  const roleMeta = getRoleMeta(user.role);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delStatus, setDelStatus] = useState<DeletionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<DeletionStatus>("/v1/auth/deletion-status").then(({ ok, data }) => {
      if (cancelled) return;
      if (ok && data) setDelStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDeletionSuccess() {
    toast("Vi har skickat en bekräftelse till din e-post.");
    // KC2.5: trigga cross-tab broadcast så övriga öppna tabs hoppar
    // ut. Vi behöver inte själva kalla logout-endpointen — server-
    // sidan har redan revokat alla sessions.
    broadcastLogout();
    // Kort delay innan navigation så toasten hinner uppstå.
    setTimeout(() => router.replace("/login"), 400);
  }

  async function handleCancelDeletion() {
    const { ok, data } = await apiFetch<{ error?: string }>(
      "/v1/auth/cancel-deletion",
      { method: "POST", body: {} }
    );
    if (!ok) {
      toast(data?.error ?? "Kunde inte avbryta raderingen.");
      return;
    }
    toast("Raderingen är avbruten.");
    setDelStatus({ status: "none" });
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inställningar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera ditt konto och dina preferenser.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Kontoinformation</h2>
          </div>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Namn</Label>
              <Input id="settings-name" value={user.name} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">E-post</Label>
              <Input id="settings-email" value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-org">Organisation</Label>
              <Input id="settings-org" value={user.orgName} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-role">Roll</Label>
              <div className="flex items-center gap-3">
                <Input id="settings-role" value={user.role} readOnly className="flex-1" />
                <Badge className={cn("shrink-0", roleMeta.color)}>
                  {roleMeta.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-brand-50/50 p-4">
            <p className="text-sm font-medium">{roleMeta.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleMeta.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Aviseringar</h2>
          </div>
          <Separator />
          {/* P3.69 (audit 2026-05-26): tidigare visade vi "Aktiv"-badgar
              utan toggle eller API som backade dem — användaren trodde
              inställningarna sparades. Kommunicera istället att vi som
              standard skickar dessa, och länka till hjälp om man vill
              ändra. Riktiga toggles tillkommer i E-prefs-sprinten. */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">E-postaviseringar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vi skickar automatiskt e-post om nya beställningar och
                uppdateringar till din kontoadress. Inställningen går
                inte att stänga av i dagsläget — mejla{" "}
                <a
                  href="mailto:hej@roots.se"
                  className="underline underline-offset-2"
                >
                  hej@roots.se
                </a>{" "}
                om du vill ändra.
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium">Leveransnotiser</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Spårnings-mejl skickas alltid när en leverans skickas
                och när den ankommer. Konfigurerbara preferenser
                kommer i ett senare release.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Tvåfaktorsautentisering</h2>
          </div>
          <Separator />
          <MfaSection />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Konto</h2>
          </div>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setPwdOpen(true)}>
              Byt lösenord
            </Button>
            {delStatus?.status === "scheduled" ? (
              <Button variant="outline" onClick={handleCancelDeletion}>
                Avbryt radering
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setDelOpen(true)}
              >
                Radera konto
              </Button>
            )}
          </div>

          {delStatus?.status === "scheduled" && delStatus.scheduledDeletionAt && (
            <div
              role="status"
              className="rounded-lg border border-warning-edge bg-warning-surface p-4 text-sm text-warning-strong"
            >
              <p className="font-medium">Ditt konto är schemalagt för radering</p>
              <p className="mt-1 text-warning-strong/80">
                Vi raderar kontot{" "}
                <strong>
                  {new Date(delStatus.scheduledDeletionAt).toLocaleDateString(
                    "sv-SE",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </strong>
                . Du kan ångra fram tills dess.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <BytLosenordDialog
        open={pwdOpen}
        onOpenChange={setPwdOpen}
        onSuccess={() => toast("Lösenordet är uppdaterat.")}
      />
      <RaderaKontoDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        onSuccess={handleDeletionSuccess}
      />
    </div>
  );
}
