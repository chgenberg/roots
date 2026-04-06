"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

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

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/dashboard/association`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams || []);
        } else {
          setError("Kunde inte hämta lagdata. Försök igen.");
        }
      } catch {
        setError("Ett nätverksfel uppstod. Försök igen.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function copyInviteLink(token: string) {
    const url = `${SITE_URL}/registrera/saljare/${token}`;
    try {
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lag</h1>
          <p className="text-sm text-muted-foreground">
            Hantera lag och skicka inbjudningslänkar till säljare
          </p>
        </div>
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
                        onClick={() => copyInviteLink(team.inviteToken)}
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
    </div>
  );
}
