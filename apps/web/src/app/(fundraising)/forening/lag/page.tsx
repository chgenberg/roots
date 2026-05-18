"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Copy,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface Team {
  id: string;
  name: string;
  memberCount: number;
  totalSalesOre: number;
  orderCount: number;
  inviteToken: string;
}

interface Campaign {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface NewInvite {
  token: string;
  teamName: string;
  campaignId: string;
}

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [newInvitedEmail, setNewInvitedEmail] = useState("");
  const [createdInvite, setCreatedInvite] = useState<NewInvite | null>(null);

  const { toast } = useToast();

  async function loadData() {
    try {
      const res = await fetch(`${API_URL}/v1/dashboard/association`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
        setCampaigns(data.campaigns || []);
        const active = (data.campaigns || []).find(
          (c: Campaign) => c.status === "ACTIVE"
        );
        if (active && !newCampaignId) setNewCampaignId(active.id);
      } else {
        setError("Kunde inte hämta lagdata. Försök igen.");
      }
    } catch {
      setError("Ett nätverksfel uppstod. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyInviteLink(token: string, isLeader: boolean) {
    const url = isLeader
      ? `${SITE_URL}/registrera/lagansvarig/${token}`
      : `${SITE_URL}/registrera/saljare/${token}`;
    try {
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  async function handleCreateInvite() {
    if (!newTeamName.trim() || newTeamName.trim().length < 2) {
      toast("Lagnamn måste vara minst 2 tecken.", "error");
      return;
    }
    if (!newCampaignId) {
      toast("Välj en kampanj.", "error");
      return;
    }
    if (
      newInvitedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newInvitedEmail.trim())
    ) {
      toast("Ogiltig e-postadress.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        token?: string;
        teamName?: string;
        campaignId?: string;
        error?: string;
      }>("/v1/association/team-invites", {
        method: "POST",
        body: {
          campaignId: newCampaignId,
          teamName: newTeamName.trim(),
          invitedEmail: newInvitedEmail.trim() || undefined,
        },
      });
      if (res.ok && res.data?.token) {
        setCreatedInvite({
          token: res.data.token,
          teamName: res.data.teamName ?? newTeamName.trim(),
          campaignId: res.data.campaignId ?? newCampaignId,
        });
        toast("Inbjudan skapad.", "success");
      } else {
        toast(res.data?.error || "Kunde inte skapa inbjudan.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setNewTeamName("");
    setNewInvitedEmail("");
    setCreatedInvite(null);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Försök igen
        </Button>
      </div>
    );
  }

  const leaderInviteUrl = createdInvite
    ? `${SITE_URL}/registrera/lagansvarig/${createdInvite.token}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lag</h1>
          <p className="text-sm text-muted-foreground">
            Hantera lag och skicka inbjudningar till lagansvariga och säljare
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Skapa nytt lag
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Inga lag har skapats ännu
            </p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Skapa ert första lag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const inviteUrl = `${SITE_URL}/registrera/saljare/${team.inviteToken}`;
            return (
              <Card key={team.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {team.memberCount} säljare
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {team.orderCount} ordrar
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {(team.totalSalesOre / 100).toLocaleString("sv-SE")}{" "}
                          kr
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Inbjudningslänk för säljare
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={inviteUrl}
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyInviteLink(team.inviteToken, false)}
                      >
                        {copiedToken === team.inviteToken ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdInvite ? "Inbjudan klar att skickas" : "Skapa nytt lag"}
            </DialogTitle>
            <DialogDescription>
              {createdInvite
                ? "Skicka länken nedan till den lagansvarige. Den fungerar i 14 dagar och kan användas en gång."
                : "Skapa ett lag och en inbjudningslänk för lagansvarig. Laget skapas automatiskt när lagansvarig registrerar sig."}
            </DialogDescription>
          </DialogHeader>

          {createdInvite ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-brand-50 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Lag
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {createdInvite.teamName}
                </p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Inbjudningslänk
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    readOnly
                    value={leaderInviteUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyInviteLink(createdInvite.token, true)}
                  >
                    {copiedToken === createdInvite.token ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tips: kopiera länken och skicka via SMS eller mejl till
                  lagansvarig. Hen sätter eget lösenord när hen klickar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="teamName">Lagnamn</Label>
                <Input
                  id="teamName"
                  placeholder="t.ex. P14 Blå, Damlag U16, Klass 7B"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div>
                <Label htmlFor="campaignId">Kampanj</Label>
                <select
                  id="campaignId"
                  value={newCampaignId}
                  onChange={(e) => setNewCampaignId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Välj kampanj…
                  </option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.status !== "ACTIVE" ? `(${c.status})` : ""}
                    </option>
                  ))}
                </select>
                {campaigns.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inga kampanjer ännu. Skapa en kampanj på översikten
                    först.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="invitedEmail">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    E-post till lagansvarig (valfritt)
                  </span>
                </Label>
                <Input
                  id="invitedEmail"
                  type="email"
                  placeholder="coach@klubben.se"
                  value={newInvitedEmail}
                  onChange={(e) => setNewInvitedEmail(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Vi sparar adressen men du måste själv skicka länken
                  manuellt just nu.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdInvite ? (
              <Button
                onClick={() => {
                  closeDialog();
                  loadData();
                }}
              >
                Klar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  disabled={submitting}
                >
                  Avbryt
                </Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={submitting || campaigns.length === 0}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Skapa inbjudan
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
