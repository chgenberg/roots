"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePortalUser } from "@/lib/portal-context";
import { Shield, Bell, Palette } from "lucide-react";
import { useToast } from "@/components/ui/toast";

function getRoleMeta(role: string) {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER")
    return { label: "Förening", description: "Föreningsmedlem med tillgång till klubbportalen.", color: "bg-brand-50 text-brand-600" };
  if (role === "SALES_REP" || role === "SALES_ADMIN")
    return { label: "Säljare", description: "Säljrepresentant med tillgång till säljportalen.", color: "bg-brand-50 text-brand-600" };
  return { label: "Admin", description: "Intern administratör med full åtkomst.", color: "bg-brand-50 text-brand-600" };
}

export default function InstallningarPage() {
  const user = usePortalUser();
  const { toast } = useToast();
  const roleMeta = getRoleMeta(user.role);

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
            <Button variant="secondary" onClick={() => toast("Lösenordsbyte kommer snart!")}>Byt lösenord</Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => toast("Kontakta support för att radera ditt konto.")}>
              Radera konto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
