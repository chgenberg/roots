"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Share2,
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Award,
  Star,
  TrendingUp,
  PlusCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { GradeBadge, GradeProgress } from "@/components/seller-grade";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { ManualOrderDialog } from "@/components/manual-order-dialog";
import { MiniTrendCard } from "@/components/charts/mini-trend-card";
import { ShareTemplates } from "@/components/share-templates";
import type { SellerDashboard as SellerDashboardData, Milestone } from "@/types/fundraising";
import QRCode from "qrcode";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function SellerDashboard() {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`${API_URL}/v1/dashboard/seller`, {
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);

        if (d.seller?.shopSlug) {
          const url = `${SITE_URL}/shop/${d.seller.shopSlug}`;
          const dataUrl = await QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            color: { dark: "#1C1410", light: "#FFFFFF" },
          });
          setQrDataUrl(dataUrl);
        }
      } else if (!silent) {
        setError("Kunde inte hämta data. Försök igen.");
      }
    } catch {
      if (!silent) setError("Ett nätverksfel uppstod. Försök igen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Live-uppdatering: poll:a säljardata var 20:e sekund så nya ordrar
    // dyker upp utan att säljaren behöver ladda om sidan.
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, [load]);

  function copyLink() {
    if (!data?.seller?.shopSlug) return;
    try {
      navigator.clipboard.writeText(`${SITE_URL}/shop/${data.seller.shopSlug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  function share() {
    if (!data?.seller?.shopSlug) return;
    const url = `${SITE_URL}/shop/${data.seller.shopSlug}`;
    try {
      if (navigator.share) {
        navigator.share({
          title: `Köp av ${data.seller.displayName} - Roots`,
          text: data.campaign?.story || "Stöd oss genom att köpa Roots-produkter!",
          url,
        });
      } else {
        copyLink();
      }
    } catch {
      copyLink();
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

  if (!data?.seller) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Ingen säljar-profil hittad
        </p>
      </div>
    );
  }

  const shopUrl = `${SITE_URL}/shop/${data.seller.shopSlug}`;
  const totalSales = data.stats?.totalSalesOre || 0;
  const orderCount = data.stats?.orderCount || 0;
  const estimatedEarnings = data.stats?.estimatedEarningsOre || 0;
  const goal = data.seller.individualGoal || 0;
  const progress =
    goal > 0
      ? Math.min(100, Math.round((totalSales / (goal * 100)) * 100))
      : null;
  const milestones = data.milestones;

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Min shop</h1>
          <p className="text-sm text-muted-foreground">
            {data.team?.name}
            {data.campaign ? ` · ${data.campaign.name}` : ""}
          </p>
        </div>
        <Button onClick={() => setManualOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Registrera order
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">Sålt</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {(totalSales / 100).toLocaleString("sv-SE")} kr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">Beställningar</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-brand-400" />
              <p className="text-xs text-muted-foreground sm:text-sm">Din uppskattade förtjänst</p>
            </div>
            <p className="mt-1 text-xl font-bold text-brand-700 sm:text-2xl">
              {(estimatedEarnings / 100).toLocaleString("sv-SE")} kr
            </p>
            {data.campaign?.marginPercent && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.campaign.marginPercent}% marginal
              </p>
            )}
          </CardContent>
        </Card>
        {progress !== null && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs text-muted-foreground sm:text-sm">Mål</p>
              <p className="mt-1 text-xl font-bold sm:text-2xl">{progress}%</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Försäljningstrend */}
      <MiniTrendCard path="/v1/dashboard/seller/stats" href="/min-shop/statistik" />

      {/* Grade card */}
      {data.grade && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <GradeBadge grade={data.grade} size="lg" />
                <div>
                  <p className="text-sm font-medium">Din nivå</p>
                  <p className="text-xs text-muted-foreground">
                    Baserat på total försäljning
                  </p>
                </div>
              </div>
            </div>
            <GradeProgress grade={data.grade} className="mt-4" />
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      {progress !== null && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Ditt mål</p>
              <p className="text-sm text-muted-foreground">
                {(totalSales / 100).toLocaleString("sv-SE")} / {goal.toLocaleString("sv-SE")} kr
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-700 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress >= 100 && (
              <p className="mt-2 text-sm font-medium text-success">
                Mål uppnått! Fantastiskt!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones && (milestones.achieved?.length > 0 || milestones.next) && (
        <Card>
          <CardHeader>
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

      {/* Share tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Dela din shop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={shopUrl} className="text-xs" />
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {qrDataUrl && (
              <div className="rounded-xl border p-3">
                <img
                  src={qrDataUrl}
                  alt="QR-kod till din shop"
                  className="h-40 w-40"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={share}>
                <Share2 className="mr-2 h-4 w-4" />
                Dela via SMS/sociala medier
              </Button>
              <Button variant="outline" asChild>
                <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Öppna min shop
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sprint E12: ready-made share copy. Sellers told us the hardest
          part isn't sharing — it's writing the message. Six pre-filled
          templates covering SMS, WhatsApp, Insta, Facebook and email. */}
      <ShareTemplates
        displayName={data.seller.displayName}
        shopUrl={shopUrl}
        campaignName={data.campaign?.name ?? "vårt lag"}
        teamName={data.team?.name ?? "vårt lag"}
      />


      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Senaste beställningar</CardTitle>
          {/* Sprint E10 — full archive lives on its own page so the
              "min-shop"-dashboard stays focused on the latest activity. */}
          <a
            href="/min-shop/bestallningar"
            className="text-xs font-medium text-brand-600 hover:text-brand-800"
          >
            Visa alla →
          </a>
        </CardHeader>
        <CardContent>
          {!data.orders || data.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga beställningar ännu. Dela din länk för att komma igång!
            </p>
          ) : (
            <div className="space-y-2">
              {data.orders?.map((order) => (
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
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        order.status === "PAID"
                          ? "bg-brand-100 text-brand-700"
                          : ""
                      }`}
                    >
                      {order.status === "PAID" ? "Betald" : order.status}
                    </Badge>
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

      <ManualOrderDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={() => load(true)}
      />
    </div>
  );
}
