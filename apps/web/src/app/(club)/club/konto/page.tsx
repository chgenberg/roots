"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export default function KontoPage() {
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const { toast } = useToast();

  async function handleSaveOrg() {
    if (!orgName.trim()) { toast("Ange föreningens namn.", "error"); return; }
    setSavingOrg(true);
    // TODO: PUT to /v1/organizations/:id
    await new Promise((r) => setTimeout(r, 600));
    setSavingOrg(false);
    toast("Uppgifter sparade!", "success");
  }

  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword) { toast("Fyll i alla lösenordsfält.", "error"); return; }
    if (newPassword !== confirmPassword) { toast("Lösenorden matchar inte.", "error"); return; }
    if (newPassword.length < 8) { toast("Lösenordet måste vara minst 8 tecken.", "error"); return; }
    setSavingPw(true);
    // TODO: POST to /v1/auth/change-password
    await new Promise((r) => setTimeout(r, 600));
    setSavingPw(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast("Lösenord uppdaterat!", "success");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Konto</h1>
        <p className="mt-1 text-muted-foreground">
          Hantera din förenings uppgifter och inställningar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Föreningens uppgifter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Föreningens namn</Label>
            <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="T.ex. Sundsvalls FK" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgNumber">Organisationsnummer</Label>
            <Input id="orgNumber" defaultValue="" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Kontakt-epost</Label>
            <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <Button size="sm" disabled={savingOrg} onClick={handleSaveOrg}>
            {savingOrg ? "Sparar..." : "Spara ändringar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Byt lösenord</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Nuvarande lösenord</Label>
            <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nytt lösenord</Label>
            <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Bekräfta nytt lösenord</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button size="sm" disabled={savingPw} onClick={handleUpdatePassword}>
            {savingPw ? "Uppdaterar..." : "Uppdatera lösenord"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-4 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <Shield className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Tvåfaktorsautentisering (MFA)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lägg till ett extra lager av säkerhet med TOTP.
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => toast("MFA-aktivering kommer snart!")}>
              Aktivera MFA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
