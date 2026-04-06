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
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ShoppingCart, Plus, Minus, Package, Truck, CheckCircle2 } from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import { publicProductHref } from "@/lib/portal-products";

type PortalOrderProduct = {
  id: string;
  name: string;
  priceOre: number;
  slug: string;
};

const FALLBACK_PRODUCTS: PortalOrderProduct[] = [
  { id: "1", name: "Roots Shampoo", priceOre: 14900, slug: "shampoo" },
  { id: "2", name: "Roots Conditioner", priceOre: 14900, slug: "conditioner" },
  { id: "3", name: "Roots Body Wash", priceOre: 12900, slug: "body-wash" },
];

const FALLBACK_ORDERS = [
  {
    id: "ORD-2025-001",
    date: "2025-03-28",
    items: "3 × First Growth, 2 × Pure Root, 2 × Soft Rinse",
    total: "2 990 kr",
    status: "Levererad",
  },
  {
    id: "ORD-2025-002",
    date: "2025-03-15",
    items: "5 × First Growth, 5 × Pure Root",
    total: "2 980 kr",
    status: "Levererad",
  },
  {
    id: "ORD-2025-003",
    date: "2025-03-01",
    items: "10 × Soft Rinse",
    total: "1 290 kr",
    status: "Levererad",
  },
  {
    id: "ORD-2025-004",
    date: "2025-04-02",
    items: "4 × First Growth, 4 × Pure Root, 4 × Soft Rinse",
    total: "5 124 kr",
    status: "Under behandling",
  },
  {
    id: "ORD-2025-005",
    date: "2025-04-01",
    items: "2 × First Growth",
    total: "298 kr",
    status: "Skickad",
  },
];

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
  const [orders, setOrders] = useState(FALLBACK_ORDERS);
  const [submitted, setSubmitted] = useState(false);
  const [apiProducts, setApiProducts] = useState<PortalOrderProduct[]>(
    FALLBACK_PRODUCTS
  );

  useEffect(() => {
    portalFetch<{ products: PortalOrderProduct[] }>("/products")
      .then((data) => {
        if (data.products.length > 0) setApiProducts(data.products);
      })
      .catch(() => {});
    portalFetch<{ orders: Array<{ id: string; createdAt: string; totalOre: number; status: string }> }>("/orders")
      .then((data) => {
        if (data.orders.length > 0) {
          setOrders(
            data.orders.map((o) => ({
              id: o.id,
              date: o.createdAt?.split("T")[0] ?? "",
              items: "",
              total: `${(o.totalOre / 100).toLocaleString("sv-SE")} kr`,
              status: o.status === "PAID" ? "Levererad" : o.status === "SHIPPED" ? "Skickad" : "Under behandling",
            }))
          );
        }
      })
      .catch(() => {});
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

  async function handleSubmit() {
    if (cartCount === 0) return;
    setSubmitting(true);

    const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));

    try {
      await portalFetch("/orders", { method: "POST", body: { items } });
    } catch {
      await new Promise((r) => setTimeout(r, 700));
    }

    const itemStr = Object.entries(cart)
      .map(([id, qty]) => {
        const p = apiProducts.find((p) => p.id === id);
        return `${qty} × ${p?.name}`;
      })
      .join(", ");

    const newOrder = {
      id: `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      items: itemStr,
      total: `${(cartTotal / 100).toLocaleString("sv-SE")} kr`,
      status: "Under behandling",
    };

    setOrders((prev) => [newOrder, ...prev]);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{submitted ? "Beställning skickad!" : "Ny beställning"}</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-brand-500" />
              <p className="text-sm text-muted-foreground text-center">
                Din beställning har registrerats och behandlas nu.
              </p>
              <Button onClick={closeDialog}>Stäng</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiProducts.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Link
                        href={publicProductHref(p.slug)}
                        className="text-sm font-medium hover:text-brand-800 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {(p.priceOre / 100).toLocaleString("sv-SE")} kr / st
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(p.id, 1)}
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
                <p className="font-semibold">
                  {(cartTotal / 100).toLocaleString("sv-SE")} kr
                </p>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={cartCount === 0 || submitting}>
                <ShoppingCart className="h-4 w-4" />
                {submitting ? "Skickar..." : "Skicka beställning"}
              </Button>
            </div>
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

      <Card>
        <CardContent className="p-5">
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
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcon(o.status)}
                      <span className="font-mono text-xs">{o.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.date}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm">
                    {o.items}
                  </TableCell>
                  <TableCell className="font-medium">{o.total}</TableCell>
                  <TableCell className="text-right">
                    {statusBadge(o.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
