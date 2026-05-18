"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy,
  CheckCircle2,
  Loader2,
  Trophy,
  Award,
  Star,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { GradeBadge, GradeProgress } from "@/components/seller-grade";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import type { TeamDashboard as TeamDashboardData, Seller, Milestone, CustomerOrder } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";

const PODIUM_ICONS = ["🥇", "🥈", "🥉"];

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function TeamDashboard() {
  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    const url = `${SITE_URL}/registrera/saljare/${data.team.inviteToken}`;
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        <p className="text-sm text-muted-foreground">
          Inget lag hittades. Kontakta din föreningsadmin.
        </p>
      </div>
    );
  }

  const sellers = data?.sellers || [];
  const totalSales = data?.stats?.totalSalesOre || 0;
  const teamEarnings = data?.stats?.teamEarningsOre || 0;
  const marginPercent = data?.stats?.marginPercent || 0;
  const orders = data?.orders || [];
  const milestones = data?.milestones;
  const sortedSellers = [...sellers].sort(
    (a: Seller, b: Seller) => b.totalSalesOre - a.totalSalesOre
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {data?.team?.name || "Lag-dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.campaign?.name || ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total försäljning</p>
            <p className="mt-1 text-2xl font-bold">
              {(totalSales / 100).toLocaleString("sv-SE")} kr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-sm text-muted-foreground">Lagets förtjänst</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {(teamEarnings / 100).toLocaleString("sv-SE")} kr
            </p>
            {marginPercent > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {marginPercent}% marginal
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Beställningar</p>
            <p className="mt-1 text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Säljare</p>
            <p className="mt-1 text-2xl font-bold">{sellers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      {milestones && (milestones.achieved?.length > 0 || milestones.next) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-500" />
              Milstolpar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {milestones.next && (
              <div className="rounded-lg bg-brand-50 p-3 flex items-center gap-3">
                <Star className="h-5 w-5 text-brand-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Nästa: {milestones.next.label}</p>
                  <p className="text-xs text-muted-foreground">{milestones.next.remaining}</p>
                </div>
              </div>
            )}
            {milestones.achieved?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {milestones.achieved.map((m: Milestone) => (
                  <Badge
                    key={m.id}
                    className="bg-brand-100 text-brand-700 text-xs py-1"
                  >
                    <Award className="h-3 w-3 mr-1" />
                    {m.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite link */}
      {data?.team?.inviteToken && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium">
              Skicka denna länk till dina spelare
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${SITE_URL}/registrera/saljare/${data.team.inviteToken}`}
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={copyInviteLink}>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seller leaderboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Säljare-ranking</CardTitle>
          <Trophy className="h-4 w-4 text-brand-500" />
        </CardHeader>
        <CardContent>
          {sortedSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga säljare har anslutit ännu. Dela inbjudningslänken!
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSellers.map((seller: Seller, i: number) => (
                <div
                  key={seller.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span
                    className={`w-6 text-center shrink-0 text-sm font-bold ${
                      i < 3 ? "text-brand-700" : "text-muted-foreground"
                    }`}
                  >
                    {i < 3 ? PODIUM_ICONS[i] : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {seller.displayName}
                      </p>
                      <GradeBadge grade={seller.grade} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {seller.orderCount} ordrar
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {(seller.totalSalesOre / 100).toLocaleString("sv-SE")} kr
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senaste beställningar</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga beställningar ännu
            </p>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 10).map((order: CustomerOrder) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setDetailOrderId(order.id);
                    setDetailOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-brand-50/60"
                  aria-label={`Visa detaljer för order från ${order.customerName}`}
                >
                  <div>
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          order.status === "PAID"
                            ? "bg-brand-100 text-brand-700"
                            : order.paymentMethod === "DIRECT_TO_LEADER"
                            ? "bg-brand-50 text-brand-600"
                            : ""
                        }`}
                      >
                        {order.status === "PAID" ? "Betald" : order.status}
                      </Badge>
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          Direktleverans
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {(order.totalOre / 100).toLocaleString("sv-SE")} kr
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
      />
    </div>
  );
}
