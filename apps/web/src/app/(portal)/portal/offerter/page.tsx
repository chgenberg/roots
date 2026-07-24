"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FileText, Plus, Send, CheckCircle2, Minus, Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { portalFetch } from "@/lib/portal-api";
import {
  quotesListResponseSchema,
  createQuoteResponseSchema,
  clubsListResponseSchema,
} from "@roots/contracts";
import { formatKr } from "@/lib/format";

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  SENT: "Skickad",
  ACCEPTED: "Accepterad",
  REJECTED: "Nekad",
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

interface QuoteRow {
  id: string;
  shortId: string;
  client: string;
  contact: string;
  totalOre: number;
  status: string;
  date: string;
  validUntil: string;
}

interface ClubOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  priceOre: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "Accepterad":
      return <Badge variant="success">{status}</Badge>;
    case "Skickad":
      return <Badge variant="secondary" className="bg-brand-50 text-brand-600">{status}</Badge>;
    case "Utkast":
      return <Badge variant="outline">{status}</Badge>;
    case "Nekad":
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ── "Ny offert"-dialog (Sprint C) ──────────────────────────────────
// Three sections: pick förening, pick produkter+qty, pick status (DRAFT
// vs SENT). Submits to POST /v1/portal/quotes which validates everything
// server-side; we just relay the result back into the table.
function NyOffertDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (row: QuoteRow) => void;
}) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sendNow, setSendNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P3.12 + P3.15 (audit 2026-05-26): tidigare gick fetch:arna parallellt
  // utan abort vid dialog-stängning, och fel hamnade i console utan att
  // användaren såg något. Nu cancellar vi via AbortController och visar
  // inline-fel istället för att lämna dialog:en i tomt state.
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSelectedOrgId(null);
    setCart({});
    setSearch("");
    setSendNow(false);
    setError(null);
    setLoadError(null);

    let cancelled = false;
    const controller = new AbortController();

    portalFetch("/clubs", {
      schema: clubsListResponseSchema,
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        setClubs(
          (data.clubs ?? []).map((c) => ({ id: c.id, name: c.name }))
        );
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("Failed to load clubs", err);
        setLoadError("Kunde inte hämta klubbar. Stäng och försök igen.");
      });

    portalFetch<{ products: ProductOption[] }>("/products", {
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        setProducts(
          (data.products ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            priceOre: p.priceOre,
          }))
        );
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("Failed to load products", err);
        setLoadError("Kunde inte hämta produkter. Stäng och försök igen.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubs.slice(0, 20);
    return clubs
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [clubs, search]);

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
    const p = products.find((x) => x.id === id);
    return sum + (p ? p.priceOre * qty : 0);
  }, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  async function handleSubmit() {
    setError(null);
    if (!selectedOrgId) {
      setError("Välj en förening.");
      return;
    }
    if (cartCount === 0) {
      setError("Lägg till minst en produkt.");
      return;
    }
    setSubmitting(true);

    try {
      const created = await portalFetch("/quotes", {
        method: "POST",
        schema: createQuoteResponseSchema,
        body: {
          orgId: selectedOrgId,
          lines: Object.entries(cart).map(([productId, qty]) => ({
            productId,
            qty,
          })),
          status: sendNow ? "SENT" : "DRAFT",
        },
      });

      const q = created.quote;
      onCreated({
        id: q.id,
        shortId: q.id.slice(0, 8).toUpperCase(),
        client: q.orgName ?? "—",
        contact: "",
        totalOre: q.totalOre,
        status: QUOTE_STATUS_LABELS[q.status] ?? q.status,
        date: formatDate(q.createdAt),
        validUntil: formatDate(q.validUntil ?? null),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa offert.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ny offert</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-2">
          {loadError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {loadError}
            </div>
          )}
          {/* Klubbpicker */}
          <div className="space-y-2">
            <Label htmlFor="club-search">Förening</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="club-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök förening…"
                className="pl-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {filteredClubs.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Inga föreningar hittades.
                </div>
              ) : (
                filteredClubs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedOrgId(c.id)}
                    className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      selectedOrgId === c.id ? "bg-brand-50 text-brand-700" : ""
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Produktrader */}
          <div className="space-y-2">
            <Label>Produkter</Label>
            <div className="space-y-2">
              {products.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Hämtar produktkatalog…
                </div>
              )}
              {products.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    {/* Scout fix 2026-05-26: min-w-0 + truncate skyddar
                        mot långa SKU-namn som annars trycker bort qty-
                        steppern i smala dialoger. */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatKr(p.priceOre)} / st
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={`Minska ${p.name}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => updateQty(p.id, 1)}
                        aria-label={`Öka ${p.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendNow}
              onChange={(e) => setSendNow(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Skicka direkt (annars sparas som utkast)
          </label>

          {/* Total + error */}
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">Totalsumma</span>
            <span className="text-base font-semibold">
              {formatKr(cartTotal)}
            </span>
          </div>
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Skapar…" : sendNow ? "Skicka offert" : "Spara utkast"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OfferterPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    portalFetch("/quotes", { schema: quotesListResponseSchema })
      .then((data) => {
        setQuotes(
          (data.quotes ?? []).map((q) => ({
            id: q.id,
            shortId: q.id.slice(0, 8).toUpperCase(),
            client: q.orgName ?? "—",
            contact: "",
            totalOre: q.totalOre,
            status: QUOTE_STATUS_LABELS[q.status] ?? q.status,
            date: formatDate(q.createdAt),
            validUntil: formatDate(q.validUntil ?? null),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSent = quotes.filter((q) => q.status === "Skickad").length;
  const totalAccepted = quotes.filter((q) => q.status === "Accepterad").length;
  const openTotalOre = quotes
    .filter((q) => q.status === "Utkast" || q.status === "Skickad")
    .reduce((sum, q) => sum + q.totalOre, 0);
  const totalValue = formatKr(openTotalOre);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offerter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skapa och hantera offerter till föreningar.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Ny offert
        </Button>
      </div>

      <NyOffertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(row) => setQuotes((prev) => [row, ...prev])}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Skickade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalAccepted}</p>
                <p className="text-xs text-muted-foreground">Accepterade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalValue}</p>
                <p className="text-xs text-muted-foreground">Totalvärde</p>
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
                <TableHead>Offert-ID</TableHead>
                <TableHead>Kund</TableHead>
                <TableHead>Kontaktperson</TableHead>
                <TableHead>Belopp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Giltig t.o.m.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.shortId}</TableCell>
                  <TableCell className="font-medium">{q.client}</TableCell>
                  <TableCell className="text-muted-foreground">{q.contact || "—"}</TableCell>
                  <TableCell className="font-medium">{formatKr(q.totalOre)}</TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{q.date}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{q.validUntil}</TableCell>
                </TableRow>
              ))}
              {!loading && quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Inga offerter ännu. Klicka på "Ny offert" för att skapa den första.
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Hämtar offerter…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
