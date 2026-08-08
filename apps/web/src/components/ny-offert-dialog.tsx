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
import { useLocale } from "@/i18n/locale-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { portalShared } from "@/i18n/dictionaries/portal-pages";
import { displayProductName } from "@/i18n/product-name";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

export type CreatedQuote = CreateQuoteResponse["quote"];

interface ClubOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  slug?: string;
  priceOre: number;
}

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
  const { locale } = useLocale();
  const t = portalPages.nyOffert[locale];
  const shared = portalShared[locale];
  const common = appCommon[locale];

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
          setLoadError(t.clubsLoadError);
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
            slug: (p as { slug?: string }).slug,
            priceOre: p.priceOre,
          }))
        );
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("Failed to load products", err);
        setLoadError(t.productsLoadError);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, presetOrgId, initialSendNow, t.clubsLoadError, t.productsLoadError]);

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
      setError(t.selectClub);
      return;
    }
    if (cartCount === 0) {
      setError(t.addProduct);
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
      setError(err instanceof Error ? err.message : t.createFail);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {presetOrg
              ? tFill(t.titleFor, { name: presetOrg.name })
              : t.title}
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
              <p className="text-xs text-muted-foreground">{t.club}</p>
              <p className="text-sm font-medium">{presetOrg.name}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="club-search">{t.club}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="club-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filteredClubs.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t.noClubs}
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
            <Label>{t.products}</Label>
            <div className="space-y-2">
              {products.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  {t.loadingProducts}
                </div>
              )}
              {products.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayProductName(locale, {
                          slug: p.slug,
                          name: p.name,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatKr(p.priceOre, locale)} {shared.perUnit}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={tFill(t.decreaseAria, {
                          name: displayProductName(locale, {
                            slug: p.slug,
                            name: p.name,
                          }),
                        })}
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
                        aria-label={tFill(t.increaseAria, {
                          name: displayProductName(locale, {
                            slug: p.slug,
                            name: p.name,
                          }),
                        })}
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
            {t.sendNow}
          </label>

          <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">{t.totalSum}</span>
            <span className="text-base font-semibold">
              {formatKr(cartTotal, locale)}
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
            {common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t.creating
              : sendNow
                ? t.sendQuote
                : t.saveDraft}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
