"use client";

import { useEffect } from "react";
import { INTEREST_TRACKING_KEYS, type InterestTracking } from "@roots/contracts";

export const TRACKING_STORAGE_KEY = "roots_tracking";

/** Var besökaren kom ifrån enligt adressen och referrern just nu. */
export function readTrackingFromLocation(): InterestTracking {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: InterestTracking = {};
  for (const key of INTEREST_TRACKING_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v.slice(0, 300);
  }
  const ref = document.referrer;
  if (ref && !ref.startsWith(window.location.origin)) out.referrer = ref.slice(0, 300);
  out.landing = window.location.pathname.slice(0, 300);
  return out;
}

/** Första besöket i fliken vinner: en utm-länk ska inte skrivas över av nästa klick. */
export function readStoredTracking(): InterestTracking {
  try {
    const raw = sessionStorage.getItem(TRACKING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InterestTracking) : {};
  } catch {
    return {};
  }
}

export function UtmCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(TRACKING_STORAGE_KEY)) return;
      sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(readTrackingFromLocation()));
    } catch {
      // Privat läge utan sessionStorage: anmälan fungerar ändå, bara utan källa.
    }
  }, []);
  return null;
}
