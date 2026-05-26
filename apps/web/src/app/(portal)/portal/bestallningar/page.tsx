"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { ShoppingCart, Plus, Minus, Package, Truck, CheckCircle2, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { portalFetch } from "@/lib/portal-api";
import { publicProductHref } from "@/lib/portal-products";
import { PortalOrderDialog } from "@/components/portal-order-dialog";
import { downloadPortalOrdersCsv } from "@/lib/orders-csv";

type PortalOrderProduct = {
  id: string;
  name: string;
  priceOre: number;
  slug: string;
};

// Real product catalogue (mirrors /v1/portal/products). Used to keep the
// "Ny beställning"-dialogen usable when the API is briefly unavailable.
// These are not fake numbers — they are our actual SKUs.
const CATALOG_FALLBACK_PRODUCTS: PortalOrderProduct[] = [
  { id: "1", name: "First Growth (schampo)", priceOre: 14900, slug: "shampoo" },
  { id: "2", name: "Pure Root (balsam)", priceOre: 14900, slug: "conditioner" },
  { id: "3", name: "Soft Rinse (body wash)", priceOre: 12900, slug: "body-wash" },
];

type OrderRow = {
  id: string;
  date: string;
  items: string;
  total: string;
  status: string;
  // Sprint E12: raw values kept alongside the formatted display strings
  // so we can filter (date range) and export CSV without re-parsing
  // localized strings.
  createdAt: string;
  totalOre: number;
  statusRaw: string;
};

function statusBadge(status: string) {
  switch (status) {
    case "Levererad":
      return <Badge variant="success">{status}</Badge>;
    case "Skickad":
      return <Badge variant="secondary" className="bg-brand-50 text-brand-700">{status}</Badge>;
    case "Under behandling":
      return <Badge variant="warning">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Levererad": return <CheckCircle2 className="h-4 w-4 text-brand-500" />;
    case "Skickad": return <Truck className="h-4 w-4 text-brand-400" />;
    default: return <Package className="h-4 w-4 text-brand-500" />;
  }
}

export default function BestallningarPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [apiProducts, setApiProducts] = useState<PortalOrderProduct[]>(
    CATALOG_FALLBACK_PRODUCTS
  );

  useEffect(() => {
    portalFetch<{ products: PortalOrderProduct[] }>("/products")
      .then((data) => {
        if (data.products.length > 0) setApiProducts(data.products);
      })
      .catch(() => {});
    portalFetch<{ orders: Array<{ id: string; createdAt: string; totalOre: number; status: string }> }>("/orders")
      .then((data) => {
        setOrders(
          (data.orders ?? []).map((o) => ({
            id: o.id,
            date: o.createdAt?.split("T")[0] ?? "",
            items: "",
            total: `${(o.totalOre / 100).toLocaleString("sv-SE")} kr`,
            status: o.status === "PAID" ? "Levererad" : o.status === "SHIPPED" ? "Skickad" : "Under behandling",
            createdAt: o.createdAt,
            totalOre: o.totalOre,
            statusRaw: o.status,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, []);

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
  // Sprint E12: filter/sök/CSV parity with /lag/bestallningar.
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Levererad" | "Skickad" | "Under behandling">("ALL");

  async function handleSubmit() {
    if (cartCount === 0) return;
    setSubmitting(true);

    const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));

    try {
      const created = await portalFetch<{ order?: { id: string; createdAt: string; totalOre: number; status: string } }>(
        "/orders",
        { method: "POST", body: { items } }
      );

      if (created.order) {
        const itemStr = Object.entries(cart)
          .map(([id, qty]) => {
            const p = apiProducts.find((p) => p.id === id);
            return `${qty} × ${p?.name}`;
          })
          .join(", ");

        const o = created.order!;
        setOrders((prev) => [
          {
            id: o.id,
            date: o.createdAt?.split("T")[0] ?? new Date().toISOString().split("T")[0],
            items: itemStr,
            total: `${(o.totalOre / 100).toLocaleString("sv-SE")} kr`,
            status: "Under behandling",
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

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beställningar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hantera och följ era beställningar.
          </p>
        </div>
        <Button onClick={() => { setDialogOpen(true); setSubmitted(false); setCart({}); }}>
          <Plus className="h-4 w-4" />
          Ny beställning
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        {/* Scout fix 2026-05-26 (UX dialog-overflow): dialogen var
            tidigare `sm:max-w-md` (448px) och content saknade horisontal
            padding → produktnamn + pris + qty-stepper trycktes in i
            varandra och hamnade utanför kortet. Vi vidgar till `lg`
            (512px) och använder DialogBody-helpern som garanterar
            px-6 pb-6. `min-w-0`/`truncate` på namnblocket skyddar mot
            extra långa SKU-namn. */}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{submitted ? "Beställning skickad!" : "Ny beställning"}</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <DialogBody className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-brand-500" />
              <p className="text-sm text-muted-foreground text-center">
                Din beställning har registrerats och behandlas nu.
              </p>
              <Button onClick={closeDialog}>Stäng</Button>
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
                      <Link
                        href={publicProductHref(p.slug)}
                        className="block truncate text-sm font-medium hover:text-brand-800 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {(p.priceOre / 100).toLocaleString("sv-SE")} kr / st
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={`Minska ${p.name}`}
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
                        aria-label={`Öka ${p.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {cartCount} {cartCount === 1 ? "produkt" : "produkter"}
                </p>
                <p className="font-semibold tabular-nums">
                  {(cartTotal / 100).toLocaleString("sv-SE")} kr
                </p>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={cartCount === 0 || submitting}>
                <ShoppingCart className="h-4 w-4" />
                {submitting ? "Skickar..." : "Skicka beställning"}
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
                <p className="text-xs text-muted-foreground">Totala beställningar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{orders.filter((o) => o.status === "Levererad").length}</p>
                <p className="text-xs text-muted-foreground">Levererade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{orders.filter((o) => o.status !== "Levererad").length}</p>
                <p className="text-xs text-muted-foreground">Pågående</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
        const toTs = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
        const needle = search.trim().toLowerCase();
        const filtered = orders.filter((o) => {
          if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
          const ts = new Date(o.createdAt).getTime();
          if (fromTs !== null && Number.isFinite(ts) && ts < fromTs) return false;
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
                  {(["ALL", "Levererad", "Skickad", "Under behandling"] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={statusFilter === f ? "default" : "outline"}
                      onClick={() => setStatusFilter(f)}
                    >
                      {f === "ALL" ? "Alla" : f}
                    </Button>
                  ))}
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadPortalOrdersCsv(
                          "klubb-bestallningar",
                          filtered.map((o) => ({
                            id: o.id,
                            createdAt: o.createdAt,
                            status: o.status,
                            totalOre: o.totalOre,
                          }))
                        )
                      }
                      disabled={filtered.length === 0}
                      className="gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Exportera CSV
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Sök order-ID eller produkt…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Från-datum"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Till-datum"
                  />
                </div>
              </CardContent>
            </Card>

      <Card>
        <CardContent className="p-5">
          {/* MASTERPLAN_01 KC6.5: 5-kolums-tabellen är bekväm på desktop
              men en mobile-supporter (vanligaste use-case för CLUB_ADMIN
              som checkar leveransstatus från soffan) får horizontal
              scroll. Mobile-listan visar samma data tappable. */}
          <ul
            className="space-y-3 lg:hidden"
            aria-label="Beställningar (lista)"
          >
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailOrderId(o.id);
                    setDetailOpen(true);
                  }}
                  className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Visa detaljer för order ${o.id.slice(0, 8)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(o.status)}
                      <span className="font-mono text-xs">
                        {o.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    {statusBadge(o.status)}
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
            {!loadingOrders && filtered.length === 0 && orders.length > 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Inga beställningar matchade dina filter.
              </li>
            )}
            {!loadingOrders && orders.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Inga beställningar ännu. Klicka på &ldquo;Ny beställning&rdquo; för
                att lägga er första.
              </li>
            )}
            {loadingOrders && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Hämtar beställningar…
              </li>
            )}
          </ul>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order-ID</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Produkter</TableHead>
                  <TableHead>Totalt</TableHead>
                  <TableHead className="text-right">Status</TableHead>
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
                    aria-label={`Visa detaljer för order ${o.id.slice(0, 8)}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(o.status)}
                        <span className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">
                      {o.items || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{o.total}</TableCell>
                    <TableCell className="text-right">
                      {statusBadge(o.status)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loadingOrders && filtered.length === 0 && orders.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Inga beställningar matchade dina filter.
                    </TableCell>
                  </TableRow>
                )}
                {!loadingOrders && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Inga beställningar ännu. Klicka på &ldquo;Ny beställning&rdquo; för att lägga er första.
                    </TableCell>
                  </TableRow>
                )}
                {loadingOrders && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Hämtar beställningar…
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
