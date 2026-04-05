import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, CheckCircle, Settings, Link as LinkIcon } from "lucide-react";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      <p className="mt-1 text-muted-foreground">
        Hantera användare, godkänn registreringar och systeminställningar.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <CheckCircle className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle>Registreringar att godkänna</CardTitle>
                <CardDescription>0 föreningar väntar på godkännande</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Inga väntande ansökningar.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <UserPlus className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle>Användare</CardTitle>
                <CardDescription>Hantera säljare och administratörer</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Inga användare att visa.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <LinkIcon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle>Fortnox-koppling</CardTitle>
                <CardDescription>Anslut till Fortnox för fakturering</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled>Anslut Fortnox (kommer snart)</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <Settings className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle>Systeminställningar</CardTitle>
                <CardDescription>AI-assistent, feature flags och mer</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">AI-assistent</span>
              <Badge variant="secondary">Avstängd</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Fortnox-integration</span>
              <Badge variant="secondary">Avstängd</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
