"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Loader2 } from "lucide-react";
import { apiFetch, rootsFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";
import { useToast } from "@/components/ui/toast";
import { formatKr } from "@/lib/format";
import { byCatalogOrder } from "@/lib/product-catalog";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { displayProductName } from "@/i18n/product-name";
import { tFill } from "@/i18n/format";

interface Product {
  id: string;
  name: string;
  slug: string;
  priceOre: number;
}

/**
 * Dialog där säljaren själv registrerar en order (kontant/Swish/kort vid
 * dörren). Skapar en manuell order via /v1/dashboard/seller/orders.
 */
export function ManualOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const { locale } = useLocale();
  const t = fundraisingPages.manualOrder[locale];
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("swish");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const paymentOptions = [
    { id: "swish", label: "Swish" },
    { id: "cash", label: t.cash },
    { id: "card", label: t.card },
  ];

  useEffect(() => {
    if (!open) return;
    rootsFetch(`${getBrowserApiBase()}/v1/shop/products`)
      .then((r) => r.json())
      .then((d) => setProducts([...(d.products || [])].sort(byCatalogOrder)))
      .catch(() => setProducts([]));
  }, [open]);

  function setProductQty(id: string, delta: number) {
    setQty((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
  }

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([productId, q]) => ({ productId, qty: q }));

  const totalOre = items.reduce((sum, it) => {
    const p = products.find((pr) => pr.id === it.productId);
    return sum + (p ? p.priceOre * it.qty : 0);
  }, 0);

  async function submit() {
    if (items.length === 0) {
      toast(t.needItem, "error");
      return;
    }
    setSaving(true);
    const { ok, data } = await apiFetch<{ error?: string }>(
      "/v1/dashboard/seller/orders",
      {
        method: "POST",
        body: {
          items,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          note: note.trim() || undefined,
        },
      }
    );
    setSaving(false);
    if (ok) {
      toast(t.success, "success");
      setQty({});
      setCustomerName("");
      setNote("");
      onOpenChange(false);
      onCreated?.();
    } else {
      toast(data?.error || t.failed, "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-2">
          <p className="text-sm text-muted-foreground">{t.intro}</p>

          <div className="space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.loadingProducts}
              </p>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayProductName(locale, {
                        slug: p.slug,
                        name: p.name,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatKr(p.priceOre, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setProductQty(p.id, -1)}
                      aria-label={tFill(t.decrease, {
                        name: displayProductName(locale, {
                          slug: p.slug,
                          name: p.name,
                        }),
                      })}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">
                      {qty[p.id] || 0}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setProductQty(p.id, 1)}
                      aria-label={tFill(t.increase, {
                        name: displayProductName(locale, {
                          slug: p.slug,
                          name: p.name,
                        }),
                      })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t.payment}
            </label>
            <div className="flex gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    paymentMethod === opt.id
                      ? "border-brand-700 bg-brand-100 font-medium"
                      : "hover:bg-brand-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t.customerName}{" "}
              <span className="text-muted-foreground">{t.optional}</span>
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t.customerPlaceholder}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t.note}{" "}
              <span className="text-muted-foreground">{t.optional}</span>
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">{t.total}</span>
            <span className="text-lg font-bold">
              {formatKr(totalOre, locale)}
            </span>
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={saving || items.length === 0}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
