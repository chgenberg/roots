"use client";

/**
 * Minimal cart hook for the supporter shop.
 *
 * Design goals:
 * - Preserve existing URL query-string contract (`?item_<productId>=<qty>`)
 *   so the checkout page keeps working when navigated to directly.
 * - Persist cart state across reloads and per-slug in sessionStorage when
 *   the `NEXT_PUBLIC_FEATURE_CART_PERSISTENCE` flag is on (default on).
 * - Stay SSR-safe: all storage access is deferred to effects.
 */

import { useCallback, useEffect, useState } from "react";
import { webFlags } from "@/lib/flags";

export type Cart = Record<string, number>;

const storageKey = (slug: string) => `roots.cart:${slug}`;

function readStorage(slug: string): Cart {
  if (typeof window === "undefined") return {};
  if (!webFlags.cartPersistence()) return {};
  try {
    const raw = sessionStorage.getItem(storageKey(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const out: Cart = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const qty = Number(v);
        if (Number.isFinite(qty) && qty > 0) out[k] = Math.floor(qty);
      }
      return out;
    }
  } catch {
    // ignore corrupt storage
  }
  return {};
}

function writeStorage(slug: string, cart: Cart) {
  if (typeof window === "undefined") return;
  if (!webFlags.cartPersistence()) return;
  try {
    sessionStorage.setItem(storageKey(slug), JSON.stringify(cart));
  } catch {
    // quota / privacy mode — silently fail
  }
}

export function useCart(slug: string) {
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(readStorage(slug));
    setHydrated(true);
  }, [slug]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(slug, cart);
  }, [cart, slug, hydrated]);

  const update = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  }, []);

  const clear = useCallback(() => setCart({}), []);

  const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);

  const toQueryString = useCallback(() => {
    const params = new URLSearchParams();
    for (const [id, qty] of Object.entries(cart)) {
      if (qty > 0) params.set(`item_${id}`, String(qty));
    }
    return params.toString();
  }, [cart]);

  return { cart, update, clear, totalItems, toQueryString, hydrated };
}
