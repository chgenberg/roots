"use client";

/**
 * Club invoice ledger — Sprint E10.
 *
 * For CLUB_ADMIN (and CLUB_MEMBER). Lists the club's own B2B orders
 * with their Fortnox invoice status so the buyer can see "are we paid
 * up?" without calling support. Uses the existing `/v1/portal/orders`
 * endpoint (no extra Fortnox round-trip needed — `fortnoxInvoiceId` +
 * `invoiceStatus` are mirrored onto our `orders` table whenever the
 * Fortnox webhook fires; see apps/api/src/routes/fortnox-webhook.ts).
 *
 * The CSV export below is the same shape an accountant can hand to
 * the club treasurer for reconciliation.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Loader2,
  Download,
  Filter,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { portalFetch } from "@/lib/portal-api";
import { PortalOrderDialog } from "@/components/portal-order-dialog";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

type ApiOrder = {
  id: string;
  createdAt: string;
  totalOre: number;
  status: string;
  invoiceStatus: "NONE" | "PENDING" | "ISSUED" | "PAID" | "CANCELLED";
  fortnoxInvoiceId: string | null;
};

const INVOICE_BADGE: Record<ApiOrder["invoiceStatus"], string> = {
  NONE: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-warning-surface text-warning-strong border-warning-edge",
  ISSUED: "bg-brand-50 text-brand-700 border-brand-200",
  PAID: "bg-success/15 text-success border-success/40",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

function formatSek(ore: number, locale: "sv" | "en"): string {
  const amount = (ore / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
  return locale === "en" ? `SEK ${amount}` : `${amount} kr`;
}

function formatDate(iso: string, dateLocale: string): string {
  try {
    return new Date(iso).toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ClubInvoicesPage() {
  const { locale } = useLocale();
  const t = portalPages.fakturor[locale];
  const shared = portalShared[locale];
  const invoiceLabels = shared.invoiceStatus;

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await portalFetch<{ orders: ApiOrder[] }>("/orders");
        setOrders(data.orders ?? []);
      } catch {
        setError(t.loadError);
      } finally {
        setLoading(false);
      }
    })();
  }, [t.loadError]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.invoiceStatus !== statusFilter) return false;
      if (fromDate) {
        const day = o.createdAt.slice(0, 10);
        if (day < fromDate) return false;
      }
      if (toDate) {
        const day = o.createdAt.slice(0, 10);
        if (day > toDate) return false;
      }
      return true;
    });
  }, [orders, statusFilter, fromDate, toDate]);

  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [filtered]
  );

  const totalPaidOre = sorted
    .filter((o) => o.invoiceStatus === "PAID")
    .reduce((acc, o) => acc + o.totalOre, 0);
  const totalIssuedOre = sorted
    .filter((o) => o.invoiceStatus === "ISSUED")
    .reduce((acc, o) => acc + o.totalOre, 0);

  function exportCsv() {
    if (sorted.length === 0) {
      toast(t.exportEmpty, "error");
      return;
    }
    const header = `${t.csvHeader}\n`;
    const rows = sorted
      .map((o) => {
        const day = o.createdAt.slice(0, 10);
        const amount = (o.totalOre / 100).toFixed(2);
        const formatted =
          locale === "en" ? amount : amount.replace(".", ",");
        const fortnox = o.fortnoxInvoiceId || "";
        return `${o.id};${day};${o.invoiceStatus};${formatted};${fortnox}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.csvFilenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <LoadError
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          {shared.exportCsv}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-sm text-muted-foreground">{t.paid}</p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatSek(totalPaidOre, locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brand-600" />
              <p className="text-sm text-muted-foreground">{t.outstanding}</p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatSek(totalIssuedOre, locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.rowsShown}</p>
            <p className="mt-1 text-2xl font-bold">{sorted.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-brand-500" />
            {shared.filter}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="invStatus">{t.statusLabel}</Label>
              <select
                id="invStatus"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">{t.allStatuses}</option>
                <option value="PAID">{invoiceLabels.PAID}</option>
                <option value="ISSUED">{invoiceLabels.ISSUED}</option>
                <option value="PENDING">{t.queued}</option>
                <option value="CANCELLED">{invoiceLabels.CANCELLED}</option>
                <option value="NONE">{invoiceLabels.NONE}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fromDate">{t.fromDate}</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="toDate">{t.toDate}</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          {(statusFilter !== "ALL" || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setStatusFilter("ALL");
                setFromDate("");
                setToDate("");
              }}
            >
              {shared.clearFilters}
            </Button>
          )}
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {orders.length === 0 ? t.empty : t.noMatch}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {sorted.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setDetailOrderId(o.id);
                    setDetailOpen(true);
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-brand-50/50 focus-visible:outline-none focus-visible:bg-brand-50"
                  aria-label={tFill(t.viewDetailsAria, {
                    id: o.id.slice(0, 8),
                  })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {tFill(t.orderLabel, { id: o.id.slice(0, 8) })}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wide ${INVOICE_BADGE[o.invoiceStatus]}`}
                      >
                        {invoiceLabels[o.invoiceStatus]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(o.createdAt, shared.dateLocale)}
                      {o.fortnoxInvoiceId && (
                        <>
                          {" · "}
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {tFill(t.fortnoxInvoice, {
                              id: o.fortnoxInvoiceId,
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">
                    {formatSek(o.totalOre, locale)}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PortalOrderDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
      />
    </div>
  );
}
