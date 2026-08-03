"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalFetch } from "@/lib/portal-api";
import {
  clubsListResponseSchema,
  createQuoteResponseSchema,
  type CreateQuoteResponse,
} from "@roots/contracts";
import { formatKr } from "@/lib/format";

export type CreatedQuote = CreateQuoteResponse["quote"];

interface ClubOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  priceOre: number;
}

/**
 * "Ny offert"-dialogen. Shared by /portal/offerter (free choice of club)
 * and /portal/pipeline (club is pre-selected — the rep dragged a lead card
 * into a quote stage, so the club is already decided and locking it keeps
 * the drag from silently quoting the wrong org).
 *
 * Everything is validated server-side by POST /v1/portal/quotes; prices in
 * particular are looked up from the catalog there, so the cart totals here
 * are display-only.
 */
export function NyOffertDialog({
  open,
  onOpenChange,
  onCreated,
  presetOrg = null,
  initialSendNow = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (quote: CreatedQuote) => void;
  presetOrg?: ClubOption | null;
  initialSendNow?: boolean;
}) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sendNow, setSendNow] = useState(initialSendNow);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const presetOrgId = presetOrg?.id ?? null;

  // P3.12 + P3.15 (audit 2026-05-26): fetch:arna cancellas via
  // AbortController vid dialog-stängning och fel visas inline istället för
  // att lämna dialog:en i tomt state.
  useEffect(() => {
    if (!open) return;
    setSelectedOrgId(presetOrgId);
    setCart({});
    setSearch("");
    setSendNow(initialSendNow);
    setError(null);
    setLoadError(null);

    let cancelled = false;
    const controller = new AbortController();

    // With a preset club there is nothing to pick, so we skip the club
    // request entirely instead of fetching a list we won't render.
    if (!presetOrgId) {
      portalFetch("/clubs", {
        schema: clubsListResponseSchema,
        signal: controller.signal,
      })
        .then((data) => {
          if (cancelled) return;
          setClubs((data.clubs ?? []).map((c) => ({ id: c.id, name: c.name })));
        })
        .catch((err) => {
          if (cancelled || (err as Error)?.name === "AbortError") return;
          console.error("Failed to load clubs", err);
          setLoadError("Kunde inte hämta klubbar. Stäng och försök igen.");
        });
    }

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
  }, [open, presetOrgId, initialSendNow]);

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubs.slice(0, 20);
    return clubs.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
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
      onCreated(created.quote);
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
          <DialogTitle>
            {presetOrg ? `Ny offert — ${presetOrg.name}` : "Ny offert"}
          </DialogTitle>
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

          {presetOrg ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Förening</p>
              <p className="text-sm font-medium">{presetOrg.name}</p>
            </div>
          ) : (
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
                        selectedOrgId === c.id
                          ? "bg-brand-50 text-brand-700"
                          : ""
                      }`}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendNow}
              onChange={(e) => setSendNow(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Skicka direkt (annars sparas som utkast)
          </label>

          <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">Totalsumma</span>
            <span className="text-base font-semibold">
              {formatKr(cartTotal)}
            </span>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
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
