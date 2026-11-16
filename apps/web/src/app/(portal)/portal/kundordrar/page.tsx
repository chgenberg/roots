"use client";

/**
 * INTERNAL_ADMIN — kundordrar och vägen till lagret.
 *
 *   GET  /v1/admin/warehouse/orders?view=queue|sent|all
 *   POST /v1/admin/warehouse/reconcile   stäm av mot Stripe
 *   POST /v1/admin/warehouse/batches     godkänn och skicka till lagret
 *   GET  /v1/admin/warehouse/batches/:id/picklist
 *   POST /v1/admin/warehouse/ship        markera skickade
 *
 * En order öppnas i samma dialog som lag och förening använder. Där finns
 * också återbetalningen, som bara intern admin ser.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { apiFetch, rootsFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";
import { formatKr } from "@/lib/format";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-status";
import { usePortalUser } from "@/lib/portal-context";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import { cn } from "@/lib/utils";

const API_URL = getBrowserApiBase();

type View = "queue" | "sent" | "all";

interface WarehouseOrder {
  id: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  deliveryType: "BULK" | "DIRECT";
  totalOre: number;
  shippingOre: number;
  refundedOre: number;
  countsTowardStats: boolean;
  customer: { name: string; email: string | null };
  campaign: { id: string; name: string };
  orgName: string;
  teamName: string;
  reconcile: { status: string | null; at: string | null; note: string | null };
  sentToWarehouseAt: string | null;
  batch: { id: string; number: number } | null;
  lines: Array<{ productName: string; qty: number }>;
}

interface ListResponse {
  orders?: WarehouseOrder[];
  counts?: { queue: number; sent: number };
  campaigns?: Array<{ id: string; name: string; orders: number }>;
  error?: string;
}

interface Batch {
  id: string;
  number: number;
  orderCount: number;
  createdAt: string;
}

interface Problem {
  orderId: string;
  status: string;
  note: string | null;
}

/** Servern tar högst så här många ordrar per anrop (ett Stripe-anrop per order). */
const MAX_ORDERS_PER_BATCH = 100;
const RECONCILE_CHUNK = 50;

/**
 * Dagens datum i svensk tid, förskjutet ett antal dagar bakåt. Räknas på
 * kalenderdagar, inte på 24 timmar, så att "igår" stämmer även dygnet då
 * klockan ställs om.
 */
function stockholmDay(daysAgo: number): string {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(
    new Date()
  );
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - daysAgo)).toISOString().slice(0, 10);
}

export default function KundordrarPage() {
  const { locale } = useLocale();
  const t = portalPages.kundordrar[locale];
  const shared = portalShared[locale];
  const user = usePortalUser();
  const { toast } = useToast();
  const dateLocale = locale === "en" ? "en-GB" : "sv-SE";

  const [view, setView] = useState<View>("queue");
  const [date, setDate] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [counts, setCounts] = useState({ queue: 0, sent: 0 });
  const [campaignOptions, setCampaignOptions] = useState<ListResponse["campaigns"]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<null | "reconcile" | "approve" | "ship">(null);
  const [newBatch, setNewBatch] = useState<(Batch & { missingAddress: number }) | null>(null);
  // Varje hämtning får ett löpnummer. Ett svar som kommer efter att en
  // nyare hämtning startat (t.ex. efter byte av flik) kastas.
  const loadSeq = useRef(0);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  // Sökningen skickas först när man slutat skriva.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view });
      if (date) params.set("date", date);
      if (campaignId) params.set("campaignId", campaignId);
      if (view === "all" && query) params.set("q", query);
      const res = await apiFetch<ListResponse>(`/v1/admin/warehouse/orders?${params}`);
      if (seq !== loadSeq.current) return;
      if (!res.ok) {
        setError(res.data?.error || (res.status === 403 ? shared.permissionDenied : t.loadError));
        setOrders([]);
        return;
      }
      const list = res.data.orders ?? [];
      const options = res.data.campaigns ?? [];
      setOrders(list);
      setCounts(res.data.counts ?? { queue: 0, sent: 0 });
      setCampaignOptions(options);
      // Markeringar på ordrar som inte längre visas ska inte följa med.
      setSelected((prev) => new Set([...prev].filter((id) => list.some((o) => o.id === id))));
      // En vald försäljning som inte längre finns i listan (t.ex. när alla
      // dess ordrar gått till lagret) får inte ligga kvar som ett osynligt
      // filter som döljer resten.
      if (campaignId && !options.some((c) => c.id === campaignId)) setCampaignId("");

      const batchRes = await apiFetch<{ batches?: Batch[] }>("/v1/admin/warehouse/batches");
      if (seq === loadSeq.current && batchRes.ok) setBatches(batchRes.data.batches ?? []);
    } catch {
      if (seq === loadSeq.current) setError(shared.networkServer);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [view, date, campaignId, query, shared.networkServer, shared.permissionDenied, t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function switchView(next: View) {
    setView(next);
    setSelected(new Set());
    setNotice(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = useMemo(() => [...selected], [selected]);

  async function reconcile() {
    const ids = selectedIds.length > 0 ? selectedIds : orders.map((o) => o.id);
    if (ids.length === 0) return;
    setWorking("reconcile");
    setNotice(null);
    const total = { ok: 0, deviations: 0 };
    try {
      // Ett Stripe-anrop per order: listan delas upp så att varje anrop
      // hinner svara inom proxyns tidsgräns.
      for (let i = 0; i < ids.length; i += RECONCILE_CHUNK) {
        const res = await apiFetch<{
          summary?: { ok: number; deviations: number };
          error?: string;
        }>("/v1/admin/warehouse/reconcile", {
          method: "POST",
          body: { orderIds: ids.slice(i, i + RECONCILE_CHUNK), locale },
        });
        if (!res.ok || !res.data.summary) {
          toast(res.data?.error || t.reconcileFail, "error");
          break;
        }
        total.ok += res.data.summary.ok;
        total.deviations += res.data.summary.deviations;
      }
      if (total.ok + total.deviations > 0) setNotice(tFill(t.reconcileDone, total));
    } catch {
      toast(t.actionFailed, "error");
    } finally {
      // Utslagen sparas per order på servern, så listan visar det som hann
      // stämmas av även om något gick fel på vägen.
      await load();
      setWorking(null);
    }
  }

  async function approve(acknowledgePartlyRefunded = false) {
    if (selectedIds.length === 0) return;
    if (selectedIds.length > MAX_ORDERS_PER_BATCH) {
      setError(tFill(t.approveMax, { max: MAX_ORDERS_PER_BATCH }));
      return;
    }
    if (
      !acknowledgePartlyRefunded &&
      !window.confirm(tFill(t.approveConfirm, { count: selectedIds.length }))
    ) {
      return;
    }
    setWorking("approve");
    setNotice(null);
    setError(null);
    try {
      const res = await apiFetch<{
        batch?: Batch;
        missingAddress?: number;
        error?: string;
        problems?: Problem[];
        canAcknowledge?: boolean;
      }>("/v1/admin/warehouse/batches", {
        method: "POST",
        body: { orderIds: selectedIds, acknowledgePartlyRefunded, locale },
      });
      if (res.ok && res.data.batch) {
        setNewBatch({ ...res.data.batch, missingAddress: res.data.missingAddress ?? 0 });
        setSelected(new Set());
        await load();
        return;
      }
      // Inget svar eller ett fel på vägen (t.ex. tidsgräns i proxyn): då
      // vet vi inte om sändningen skapades. Säg det, i stället för att
      // påstå att inget skickats.
      if (res.status >= 500 && !res.data?.problems) {
        await load();
        setError(res.status === 500 ? res.data?.error || t.approveFail : t.approveUnknown);
        return;
      }
      // Servern har sparat utslaget på varje order, så listan visar vad som
      // inte stämde när den laddats om.
      await load();
      if (res.data?.canAcknowledge && !acknowledgePartlyRefunded) {
        if (window.confirm(t.approveAcknowledge)) {
          setWorking(null);
          await approve(true);
        }
        return;
      }
      setError(
        res.data?.problems?.length
          ? tFill(t.approveBlocked, { count: res.data.problems.length })
          : res.data?.error || t.approveFail
      );
    } catch {
      await load().catch(() => {});
      setError(t.approveUnknown);
    } finally {
      setWorking(null);
    }
  }

  async function ship() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(tFill(t.shipConfirm, { count: selectedIds.length }))) return;
    setWorking("ship");
    setNotice(null);
    try {
      const res = await apiFetch<{
        shipped?: number;
        skipped?: Array<{ orderId: string }>;
        error?: string;
      }>("/v1/admin/warehouse/ship", { method: "POST", body: { orderIds: selectedIds, locale } });
      if (!res.ok) {
        toast(res.data?.error || t.shipFail, "error");
        return;
      }
      const skipped = res.data.skipped?.length ?? 0;
      setNotice(
        [
          tFill(t.shipDone, { count: res.data.shipped ?? 0 }),
          skipped > 0 ? tFill(t.shipSkipped, { count: skipped }) : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setSelected(new Set());
      await load();
    } catch {
      await load().catch(() => {});
      toast(t.actionFailed, "error");
    } finally {
      setWorking(null);
    }
  }

  async function download(batch: { id: string }, format: "xlsx" | "csv") {
    try {
      const res = await rootsFetch(
        `${API_URL}/v1/admin/warehouse/batches/${batch.id}/picklist?format=${format}`
      );
      if (!res.ok) {
        toast(t.downloadFail, "error");
        return;
      }
      const filename =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        `Roots_plocklista.${format}`;
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast(t.downloadFail, "error");
    }
  }

  function reconcileBadge(order: WarehouseOrder) {
    const status = order.reconcile.status;
    const key = `rc${status ?? "None"}` as keyof typeof t;
    const label = (t[key] as string | undefined) ?? status ?? t.rcNone;
    const variant =
      status === "OK"
        ? "success"
        : status === null
          ? "outline"
          : status === "PARTLY_REFUNDED"
            ? "warning"
            : "destructive";
    return (
      <div className="space-y-1">
        <Badge variant={variant}>
          {status === "OK" && <ShieldCheck className="mr-1 h-3 w-3" />}
          {status !== null && status !== "OK" && <ShieldAlert className="mr-1 h-3 w-3" />}
          {label}
        </Badge>
        {order.reconcile.note && status !== "OK" && (
          <p className="max-w-[240px] text-pretty text-xs text-muted-foreground">
            {order.reconcile.note}
          </p>
        )}
      </div>
    );
  }

  const selectable = view !== "all";
  const okIds = orders.filter((o) => o.reconcile.status === "OK").map((o) => o.id);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {shared.refresh}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["queue", tFill(t.tabQueue, { count: counts.queue })],
            ["sent", tFill(t.tabSent, { count: counts.sent })],
            ["all", t.tabAll],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            size="sm"
            variant={view === key ? "default" : "outline"}
            onClick={() => switchView(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="wh-day">{t.dayLabel}</Label>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["", t.dayAll],
                  [stockholmDay(1), t.dayYesterday],
                  [stockholmDay(0), t.dayToday],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={date === value ? "default" : "outline"}
                  onClick={() => setDate(value)}
                >
                  {label}
                </Button>
              ))}
              <Input
                id="wh-day"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-campaign">{t.campaignLabel}</Label>
            <select
              id="wh-campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="flex h-10 min-w-[220px] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">{t.campaignAll}</option>
              {(campaignOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.orders})
                </option>
              ))}
            </select>
          </div>
          {view === "all" && (
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="wh-search">{t.searchLabel}</Label>
              <Input
                id="wh-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-pretty">{error}</p>
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm">
          {notice}
        </p>
      )}

      {newBatch && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-700" />
          <div className="min-w-[220px] flex-1">
            <p className="font-semibold">
              {tFill(t.batchCreated, { number: newBatch.number, count: newBatch.orderCount })}
            </p>
            <p className="text-muted-foreground">{t.batchDownload}</p>
            {newBatch.missingAddress > 0 && (
              <p className="mt-1 text-pretty font-medium text-destructive">
                {tFill(t.batchMissingAddress, { count: newBatch.missingAddress })}
              </p>
            )}
          </div>
          <Button type="button" size="sm" onClick={() => void download(newBatch, "xlsx")}>
            <Download className="mr-2 h-4 w-4" />
            {t.downloadXlsx}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void download(newBatch, "csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            {t.downloadCsv}
          </Button>
        </div>
      )}

      {selectable && orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {view === "queue" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working !== null}
                onClick={() => void reconcile()}
              >
                {working === "reconcile" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {working === "reconcile"
                  ? t.reconciling
                  : selectedIds.length > 0
                    ? tFill(t.reconcileSelected, { count: selectedIds.length })
                    : t.reconcile}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working !== null || okIds.length === 0}
                onClick={() => setSelected(new Set(okIds))}
              >
                {t.selectOk}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={working !== null || selectedIds.length === 0}
                onClick={() => void approve()}
              >
                {working === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {working === "approve"
                  ? t.approving
                  : tFill(t.approve, { count: selectedIds.length })}
              </Button>
            </>
          )}
          {view === "sent" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working !== null}
                onClick={() => setSelected(new Set(orders.map((o) => o.id)))}
              >
                {t.selectAll}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={working !== null || selectedIds.length === 0}
                onClick={() => void ship()}
              >
                {working === "ship" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="mr-2 h-4 w-4" />
                )}
                {working === "ship" ? t.shipping : tFill(t.ship, { count: selectedIds.length })}
              </Button>
            </>
          )}
          {selectedIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={working !== null}
              onClick={() => setSelected(new Set())}
            >
              {t.selectNone}
            </Button>
          )}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      ) : orders.length === 0 && !error ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {view === "queue" ? t.emptyQueue : view === "sent" ? t.emptySent : t.emptyAll}
          </CardContent>
        </Card>
      ) : orders.length > 0 ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {selectable && <th className="w-10 p-3" />}
                  <th className="p-3 font-medium">{t.colOrder}</th>
                  <th className="p-3 font-medium">{t.colPaid}</th>
                  <th className="p-3 font-medium">{t.colCustomer}</th>
                  <th className="p-3 font-medium">{t.colSale}</th>
                  <th className="p-3 font-medium">{t.colDelivery}</th>
                  <th className="p-3 text-right font-medium">{t.colAmount}</th>
                  <th className="p-3 font-medium">
                    {view === "queue" ? t.colReconcile : view === "sent" ? t.colBatch : t.colStatus}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const paid = o.paidAt ?? o.createdAt;
                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "border-b last:border-0",
                        selected.has(o.id) && "bg-brand-50/60"
                      )}
                    >
                      {selectable && (
                        <td className="p-3 align-top">
                          <input
                            type="checkbox"
                            aria-label={o.id.slice(0, 8)}
                            checked={selected.has(o.id)}
                            onChange={() => toggle(o.id)}
                            className="h-4 w-4 accent-brand-700"
                          />
                        </td>
                      )}
                      <td className="p-3 align-top">
                        <button
                          type="button"
                          onClick={() => setDetailOrderId(o.id)}
                          className="font-mono text-xs font-semibold uppercase underline-offset-2 hover:underline"
                        >
                          {o.id.slice(0, 8)}
                        </button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {o.lines.map((l) => `${l.qty} × ${l.productName}`).join(", ")}
                        </p>
                        {!o.countsTowardStats && (
                          <Badge variant="outline" className="mt-1">
                            {t.outsidePeriod}
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3 align-top text-muted-foreground">
                        {new Date(paid).toLocaleString(dateLocale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 align-top">{o.customer.name}</td>
                      <td className="p-3 align-top">
                        <p>{o.campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.orgName} · {o.teamName}
                        </p>
                      </td>
                      <td className="p-3 align-top">
                        {o.deliveryType === "DIRECT" ? t.deliveryHome : t.deliveryClub}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right align-top tabular-nums">
                        {formatKr(o.totalOre, locale)}
                        {o.refundedOre > 0 && (
                          <p className="text-xs text-destructive">
                            {tFill(t.refundedPart, { amount: formatKr(o.refundedOre, locale) })}
                          </p>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        {view === "queue" ? (
                          reconcileBadge(o)
                        ) : view === "sent" && o.batch ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{tFill(t.batchLabel, { number: o.batch.number })}</span>
                            <button
                              type="button"
                              onClick={() => void download(o.batch!, "xlsx")}
                              className="text-xs underline underline-offset-2"
                            >
                              {t.downloadXlsx}
                            </button>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              orderStatusColor(o.status)
                            )}
                          >
                            {orderStatusLabel(o.status, locale)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {view === "sent" && batches.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.recentBatches}
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {batches.slice(0, 10).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    {tFill(t.batchRow, {
                      number: b.number,
                      count: b.orderCount,
                      date: new Date(b.createdAt).toLocaleDateString(dateLocale),
                    })}
                  </span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void download(b, "xlsx")}
                      className="underline underline-offset-2"
                    >
                      {t.downloadXlsx}
                    </button>
                    <button
                      type="button"
                      onClick={() => void download(b, "csv")}
                      className="underline underline-offset-2"
                    >
                      {t.downloadCsv}
                    </button>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === "INTERNAL_ADMIN" && (
        <OrderDetailDialog
          open={detailOrderId !== null}
          onOpenChange={(open) => {
            if (!open) setDetailOrderId(null);
          }}
          orderId={detailOrderId}
          onStatusChange={() => void load()}
        />
      )}
    </div>
  );
}
