"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isTrackable } from "@/lib/trackable-path";

/**
 * Anonym besöksstatistik för admin-sidan Trafik.
 *
 * Skickar en rad per sidvisning och per klick på länkar och knappar. Inga
 * cookies, inget id i localStorage, ingen IP sparas — raden kan inte kopplas
 * till en person eller till besökarens övriga rader. Därför behövs inget
 * samtycke. Samma sidurval som GA4 (`lib/trackable-path.ts`), och aldrig
 * formulärfältens innehåll.
 */

const ENDPOINT = "/api/v1/telemetry/traffic";

type Payload = {
  kind: "page" | "click";
  path: string;
  label?: string;
  href?: string;
  source?: string;
  device: "mobile" | "tablet" | "desktop";
};

function device(): Payload["device"] {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function send(payload: Payload) {
  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* statistiken får aldrig störa sidan */
  }
}

function entrySource(): string | undefined {
  const params = new URLSearchParams(location.search);
  const utm = params.get("utm_source");
  if (utm) return utm.slice(0, 120);
  if (!document.referrer) return undefined;
  try {
    const ref = new URL(document.referrer);
    if (ref.host === location.host) return undefined;
    return ref.host.replace(/^www\./, "").slice(0, 120);
  } catch {
    return undefined;
  }
}

function describeHref(a: HTMLAnchorElement): string | undefined {
  const raw = a.getAttribute("href");
  if (!raw || raw.startsWith("#")) return undefined;
  try {
    const url = new URL(a.href, location.href);
    if (url.protocol === "tel:" || url.protocol === "mailto:") {
      return `${url.protocol}${url.pathname}`;
    }
    if (url.origin === location.origin) return url.pathname;
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return undefined;
  }
}

function labelOf(el: Element): string | undefined {
  const text =
    el.getAttribute("aria-label") ||
    (el as HTMLElement).innerText ||
    el.textContent ||
    el.querySelector("img")?.getAttribute("alt") ||
    "";
  const v = text.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 80) : undefined;
}

export function TrafficTracker() {
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    if (!pathname || !isTrackable(pathname, location.search)) return;
    const source = firstView.current ? entrySource() : undefined;
    firstView.current = false;
    send({ kind: "page", path: pathname, source, device: device() });
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!isTrackable(location.pathname, location.search)) return;
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest("a[href], button, [role='button']");
      if (!el || el.closest("[data-no-track]")) return;
      send({
        kind: "click",
        path: location.pathname,
        label: labelOf(el),
        href: el instanceof HTMLAnchorElement ? describeHref(el) : undefined,
        device: device(),
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
