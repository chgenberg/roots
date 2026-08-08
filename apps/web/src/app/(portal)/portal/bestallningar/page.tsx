"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Truck,
  CheckCircle2,
  Search,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { portalFetch } from "@/lib/portal-api";
import { LoadError } from "@/components/load-error";
import {
  publicProductHref,
  byCatalogOrder,
  BUNDLE_SLUG,
} from "@/lib/product-catalog";
import { PortalOrderDialog } from "@/components/portal-order-dialog";
import { downloadPortalOrdersCsv } from "@/lib/orders-csv";
import { formatKrValue } from "@/lib/format";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { displayProductName } from "@/i18n/product-name";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

type PortalOrderProduct = {
  id: string;
  name: string;
  priceOre: number;
  slug: string;
};

type DisplayStatus = "delivered" | "shipped" | "processing";

function catalogFallbackProducts(
  bundleName: string
): PortalOrderProduct[] {
  return [
    { id: "1", name: "Roots Schampoo", priceOre: 14900, slug: "shampoo" },
    { id: "2", name: "Roots Conditioner", priceOre: 14900, slug: "conditioner" },
    { id: "3", name: "Roots Body Wash", priceOre: 12900, slug: "body-wash" },
    {
      id: "4",
      name: bundleName,
      priceOre: 39900,
      slug: BUNDLE_SLUG,
    },
  ];
}

type OrderRow = {
  id: string;
  date: string;
  items: string;
  total: string;
  status: DisplayStatus;
  createdAt: string;
  totalOre: number;
  statusRaw: string;
};

function mapApiStatus(status: string): DisplayStatus {
  if (status === "PAID" || status === "DELIVERED") return "delivered";
  if (status === "SHIPPED") return "shipped";
  return "processing";
}

function statusLabel(
  status: DisplayStatus,
  labels: Record<DisplayStatus, string>
) {
  return labels[status];
}

function statusBadge(
  status: DisplayStatus,
  labels: Record<DisplayStatus, string>
) {
  const text = statusLabel(status, labels);
  switch (status) {
    case "delivered":
      return <Badge variant="success">{text}</Badge>;
    case "shipped":
      return (
        <Badge variant="secondary" className="bg-brand-50 text-brand-700">
          {text}
        </Badge>
      );
    case "processing":
      return <Badge variant="warning">{text}</Badge>;
    default:
      return <Badge variant="secondary">{text}</Badge>;
  }
}

function statusIcon(status: DisplayStatus) {
  switch (status) {
    case "delivered":
      return <CheckCircle2 className="h-4 w-4 text-brand-500" />;
    case "shipped":
      return <Truck className="h-4 w-4 text-brand-400" />;
    default:
      return <Package className="h-4 w-4 text-brand-500" />;
  }
}

export default function BestallningarPage() {
  const { locale } = useLocale();
  const t = portalPages.bestallningar[locale];
  const shared = portalShared[locale];
  const common = appCommon[locale];
  const statusLabels = shared.orderStatusDisplay;
  const bundleName = portalPages.produkter[locale].bundleName;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [usingFallbackProducts, setUsingFallbackProducts] = useState(true);
  const [apiProducts, setApiProducts] = useState<PortalOrderProduct[]>(() =>
    catalogFallbackProducts(bundleName)
  );

  useEffect(() => {
    if (usingFallbackProducts) {
      setApiProducts(catalogFallbackProducts(bundleName));
    }
  }, [bundleName, usingFallbackProducts]);

  const loadOrders = useCallback(() => {
    setLoadingOrders(true);
    setOrdersError(null);
    portalFetch<{ products: PortalOrderProduct[] }>("/products")
      .then((data) => {
        if (data.products.length > 0) {
          setUsingFallbackProducts(false);
          setApiProducts([...data.products].sort(byCatalogOrder));
        }
      })
      .catch(() => {});
    portalFetch<{
      orders: Array<{
        id: string;
        createdAt: string;
        totalOre: number;
        status: string;
      }>;
    }>("/orders")
      .then((data) => {
        setOrders(
          (data.orders ?? []).map((o) => ({
            id: o.id,
            date: o.createdAt?.split("T")[0] ?? "",
            items: "",
            total: `${formatKrValue(o.totalOre, locale)} ${shared.kr}`,
            status: mapApiStatus(o.status),
            createdAt: o.createdAt,
            totalOre: o.totalOre,
            statusRaw: o.status,
          }))
        );
      })
      .catch(() => {
        setOrdersError(t.loadError);
      })
      .finally(() => setLoadingOrders(false));
  }, [shared.kr, t.loadError]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const val = (next[productId] || 0) + delta;
      if (val <= 0) delete next[productId];
      else next[productId] = val;
      return next;
    });
  }

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = apiProducts.find((p) => p.id === id);
    return sum + (p ? p.priceOre * qty : 0);
  }, 0);

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DisplayStatus>(
    "ALL"
  );

  async function handleSubmit() {
    if (cartCount === 0) return;
    setSubmitting(true);

    const items = Object.entries(cart).map(([productId, qty]) => ({
      productId,
      qty,
    }));

    try {
      const created = await portalFetch<{
        order?: {
          id: string;
          createdAt: string;
          totalOre: number;
          status: string;
        };
      }>("/orders", { method: "POST", body: { items } });

      if (created.order) {
        const itemStr = Object.entries(cart)
          .map(([id, qty]) => {
            const p = apiProducts.find((p) => p.id === id);
            const name = p
              ? displayProductName(locale, { slug: p.slug, name: p.name })
              : "";
            return `${qty} × ${name}`;
          })
          .join(", ");

        const o = created.order!;
        setOrders((prev) => [
          {
            id: o.id,
            date:
              o.createdAt?.split("T")[0] ??
              new Date().toISOString().split("T")[0],
            items: itemStr,
            total: `${formatKrValue(o.totalOre, locale)} ${shared.kr}`,
            status: "processing",
            createdAt: o.createdAt ?? new Date().toISOString(),
            totalOre: o.totalOre,
            statusRaw: o.status,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Order creation failed", err);
    }

    setCart({});
    setSubmitting(false);
    setSubmitted(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSubmitted(false);
    setCart({});
  }

  const filterKeys = [
    "ALL",
    "delivered",
    "shipped",
    "processing",
  ] as const;

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          onClick={() => {
            setDialogOpen(true);
            setSubmitted(false);
            setCart({});
          }}
        >
          <Plus className="h-4 w-4" />
          {t.newOrder}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {submitted ? t.orderSent : t.newOrder}
            </DialogTitle>
          </DialogHeader>

          {submitted ? (
            <DialogBody className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-brand-500" />
              <p className="text-sm text-muted-foreground text-center">
                {t.orderRegistered}
              </p>
              <Button onClick={closeDialog}>{common.close}</Button>
            </DialogBody>
          ) : (
            <DialogBody className="space-y-4">
              {apiProducts.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <LocaleLink
                        href={publicProductHref(p.slug)}
                        className="block truncate text-sm font-medium hover:text-brand-800 hover:underline"
                      >
                        {displayProductName(locale, {
                          slug: p.slug,
                          name: p.name,
                        })}
                      </LocaleLink>
                      <p className="text-xs text-muted-foreground">
                        {formatKrValue(p.priceOre, locale)} {shared.perUnit}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={tFill(t.decreaseAria, {
                          name: displayProductName(locale, {
                            slug: p.slug,
                            name: p.name,
                          }),
                        })}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span
                        className="w-6 text-center text-sm font-medium tabular-nums"
                        aria-live="polite"
                      >
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(p.id, 1)}
                        aria-label={tFill(t.increaseAria, {
                          name: displayProductName(locale, {
                            slug: p.slug,
                            name: p.name,
                          }),
                        })}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {cartCount}{" "}
                  {cartCount === 1 ? t.productOne : t.productMany}
                </p>
                <p className="font-semibold tabular-nums">
                  {formatKrValue(cartTotal, locale)} {shared.kr}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={cartCount === 0 || submitting}
              >
                <ShoppingCart className="h-4 w-4" />
                {submitting ? t.sending : t.sendOrder}
              </Button>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">{t.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => o.status === "delivered").length}
                </p>
                <p className="text-xs text-muted-foreground">{t.delivered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter((o) => o.status !== "delivered").length}
                </p>
                <p className="text-xs text-muted-foreground">{t.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const fromTs = dateFrom
          ? new Date(dateFrom + "T00:00:00").getTime()
          : null;
        const toTs = dateTo
          ? new Date(dateTo + "T23:59:59.999").getTime()
          : null;
        const needle = search.trim().toLowerCase();
        const filtered = orders.filter((o) => {
          if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
          const ts = new Date(o.createdAt).getTime();
          if (fromTs !== null && Number.isFinite(ts) && ts < fromTs)
            return false;
          if (toTs !== null && Number.isFinite(ts) && ts > toTs) return false;
          if (needle) {
            const hay = `${o.id} ${o.items} ${o.statusRaw}`.toLowerCase();
            if (!hay.includes(needle)) return false;
          }
          return true;
        });

        return (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {filterKeys.map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={statusFilter === f ? "default" : "outline"}
                      onClick={() => setStatusFilter(f)}
                    >
                      {f === "ALL" ? shared.all : statusLabels[f]}
                    </Button>
                  ))}
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadPortalOrdersCsv(
                          locale === "en"
                            ? "club-orders"
                            : "klubb-bestallningar",
                          filtered.map((o) => ({
                            id: o.id,
                            createdAt: o.createdAt,
                            status: statusLabel(o.status, statusLabels),
                            totalOre: o.totalOre,
                          })),
                          locale
                        )
                      }
                      disabled={filtered.length === 0}
                      className="gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      {shared.exportCsv}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.searchPlaceholder}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label={t.dateFromAria}
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label={t.dateToAria}
                  />
                </div>
              </CardContent>
            </Card>

            {ordersError && (
              <LoadError message={ordersError} onRetry={loadOrders} inline />
            )}

            <Card>
              <CardContent className="p-5">
                <ul className="space-y-3 lg:hidden" aria-label={t.listAria}>
                  {filtered.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailOrderId(o.id);
                          setDetailOpen(true);
                        }}
                        className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={tFill(t.viewDetailsAria, {
                          id: o.id.slice(0, 8),
                        })}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {statusIcon(o.status)}
                            <span className="font-mono text-xs">
                              {o.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          {statusBadge(o.status, statusLabels)}
                        </div>
                        <div className="mt-2 line-clamp-2 text-sm">
                          {o.items || "—"}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{o.date}</span>
                          <span className="font-medium text-foreground">
                            {o.total}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {!loadingOrders &&
                    filtered.length === 0 &&
                    orders.length > 0 && (
                      <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        {t.noMatch}
                      </li>
                    )}
                  {!loadingOrders && !ordersError && orders.length === 0 && (
                    <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      {t.empty}
                    </li>
                  )}
                  {loadingOrders && (
                    <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      {t.loading}
                    </li>
                  )}
                </ul>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.colOrderId}</TableHead>
                        <TableHead>{t.colDate}</TableHead>
                        <TableHead>{t.colProducts}</TableHead>
                        <TableHead>{t.colTotal}</TableHead>
                        <TableHead className="text-right">
                          {t.colStatus}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((o) => (
                        <TableRow
                          key={o.id}
                          onClick={() => {
                            setDetailOrderId(o.id);
                            setDetailOpen(true);
                          }}
                          className="cursor-pointer transition-colors hover:bg-brand-50/50"
                          aria-label={tFill(t.viewDetailsAria, {
                            id: o.id.slice(0, 8),
                          })}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusIcon(o.status)}
                              <span className="font-mono text-xs">
                                {o.id.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {o.date}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm">
                            {o.items || "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {o.total}
                          </TableCell>
                          <TableCell className="text-right">
                            {statusBadge(o.status, statusLabels)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loadingOrders &&
                        filtered.length === 0 &&
                        orders.length > 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="py-8 text-center text-muted-foreground"
                            >
                              {t.noMatch}
                            </TableCell>
                          </TableRow>
                        )}
                      {!loadingOrders &&
                        !ordersError &&
                        orders.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="py-8 text-center text-muted-foreground"
                            >
                              {t.empty}
                            </TableCell>
                          </TableRow>
                        )}
                      {loadingOrders && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-muted-foreground"
                          >
                            {t.loading}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}

      <PortalOrderDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
      />
    </div>
  );
}
