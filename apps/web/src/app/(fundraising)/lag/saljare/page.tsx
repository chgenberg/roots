"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  ExternalLink,
  Loader2,
  Trophy,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { TeamDashboard, Seller } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function TeamSellersPage() {
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedShop, setCopiedShop] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const myTeamRes = await fetch(`${API_URL}/v1/dashboard/my-team`, {
          credentials: "include",
        });
        if (!myTeamRes.ok) {
          setError("Kunde inte hämta lagdata. Försök igen.");
          return;
        }
        const { teamId } = await myTeamRes.json();

        const teamRes = await fetch(
          `${API_URL}/v1/dashboard/team/${teamId}`,
          { credentials: "include" }
        );
        if (teamRes.ok) {
          setData(await teamRes.json());
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

  function copyInviteLink() {
    if (!data?.team?.inviteToken) return;
    try {
      navigator.clipboard.writeText(
        `${SITE_URL}/registrera/saljare/${data.team.inviteToken}`
      );
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  function copyShopLink(slug: string) {
    try {
      navigator.clipboard.writeText(`${SITE_URL}/shop/${slug}`);
      setCopiedShop(slug);
      setTimeout(() => setCopiedShop(null), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
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

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Users className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Inget lag hittades</p>
      </div>
    );
  }

  const sellers: Seller[] = data.sellers || [];
  const sortedSellers = [...sellers].sort(
    (a: Seller, b: Seller) => b.totalSalesOre - a.totalSalesOre
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Säljare</h1>
        <p className="text-sm text-muted-foreground">
          {sellers.length} säljare i {data.team?.name}
        </p>
      </div>

      {data?.team?.inviteToken && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium">
              Bjud in fler säljare med denna länk
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${SITE_URL}/registrera/saljare/${data.team.inviteToken}`}
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={copyInviteLink}>
                {copiedInvite ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand-500" />
            Säljare-ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga säljare har anslutit ännu. Dela inbjudningslänken!
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSellers.map((seller: Seller, i: number) => (
                <div
                  key={seller.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-brand-500 w-5 text-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {seller.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {seller.orderCount} ordrar ·{" "}
                        {(seller.totalSalesOre / 100).toLocaleString("sv-SE")}{" "}
                        kr
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {(seller.totalSalesOre / 100).toLocaleString("sv-SE")} kr
                    </p>
                  </div>
                  {seller.shopSlug && (
                    <div className="flex gap-2 ml-10">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => copyShopLink(seller.shopSlug)}
                      >
                        {copiedShop === seller.shopSlug ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        Kopiera shop-länk
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        asChild
                      >
                        <a
                          href={`${SITE_URL}/shop/${seller.shopSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Öppna shop
                        </a>
                      </Button>
                    </div>
                  )}
                  {seller.individualGoal != null && seller.individualGoal > 0 && (
                    <div className="ml-10">
                      <div className="h-2 overflow-hidden rounded-full bg-brand-100 mt-1">
                        <div
                          className="h-full rounded-full bg-brand-700 transition-all duration-700"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (seller.totalSalesOre /
                                  (seller.individualGoal * 100)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(seller.totalSalesOre / 100).toLocaleString("sv-SE")}{" "}
                        / {seller.individualGoal.toLocaleString("sv-SE")} kr
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
