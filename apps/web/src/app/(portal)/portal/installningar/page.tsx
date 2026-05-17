"use client";

import { useState } from "react";
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
import { Shield, Bell, Palette } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";

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
            <p className="text-xs text-red-600" role="alert">
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

export default function InstallningarPage() {
  const user = usePortalUser();
  const { toast } = useToast();
  const roleMeta = getRoleMeta(user.role);
  const [pwdOpen, setPwdOpen] = useState(false);

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">E-postaviseringar</p>
                <p className="text-xs text-muted-foreground">
                  Få e-post om nya beställningar och uppdateringar.
                </p>
              </div>
              <Badge variant="success">Aktiv</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Leveransnotiser</p>
                <p className="text-xs text-muted-foreground">
                  Bli meddelad när leveranser skickas och ankommer.
                </p>
              </div>
              <Badge variant="success">Aktiv</Badge>
            </div>
          </div>
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
            <Button variant="outline" className="text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => toast("Kontakta support för att radera ditt konto.")}>
              Radera konto
            </Button>
          </div>
        </CardContent>
      </Card>

      <BytLosenordDialog
        open={pwdOpen}
        onOpenChange={setPwdOpen}
        onSuccess={() => toast("Lösenordet är uppdaterat.")}
      />
    </div>
  );
}
