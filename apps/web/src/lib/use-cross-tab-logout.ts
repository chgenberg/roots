"use client";

import { useEffect } from "react";

/**
 * MASTERPLAN_01 KC2.5 — multi-tab logout-sync.
 *
 * Problem: när användaren loggar ut i en tab live:r övriga tabs vidare
 * tills nästa /me-poll, vilket gör att de hinner mutera data (skapa
 * order, ändra inställningar) som de tror är inloggade men sessionen
 * är redan död server-side. Det är både dataintegritets- och
 * trust-issue ("varför fortsatte sajten låtsas att jag var inloggad?").
 *
 * Lösning: en singleton-`BroadcastChannel("roots-auth")` + en
 * `localStorage.setItem("roots:logout", Date.now())`-fallback för
 * miljöer utan BroadcastChannel (gamla iOS-Safari, vissa enterprise-
 * browsers). På varje annan tab i samma origin trigger:as `onLogout`
 * inom 30-60ms.
 *
 * Helpers exporteras separat så att vi kan kalla `broadcastLogout()`
 * från `handleLogout` (alla layouts) utan att också importera en hook.
 *
 * Designval:
 *   - Vi använder INTE en delad zustand-/context-state. `broadcastLogout`
 *     ska kunna kallas från async handlers utan re-render.
 *   - `localStorage`-fallbacken sätter ett timestamp så samma tab inte
 *     trigger:as av sin egen write (sätt-och-läs in samma `storage`-
 *     event på alla *andra* tabs, vilket är vad vi vill).
 *   - Vi använder ett `lastSeen`-state istället för en single-fire
 *     `useState(false)` så att två snabba logouts i rad fortfarande
 *     trigger:ar listening tabs (även om det är osannolikt).
 */

const CHANNEL_NAME = "roots-auth";
const STORAGE_KEY = "roots:logout";

type AuthEvent = { type: "logout"; at: number };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (_channel) return _channel;
  // BroadcastChannel saknas i typ-systemet på Safari < 15.4 men finns
  // i moderna iOS. Skydda:t med typeof-check.
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    _channel = null;
  }
  return _channel;
}

/**
 * Skicka en logout-broadcast till alla andra tabs på samma origin.
 * No-op på server-render. Får INTE göras innan POST /v1/auth/logout
 * är awaited; annars kan listening tabs hinna redirecta först och
 * sedan se en kvarvarande session i sin /me-cache.
 */
export function broadcastLogout(): void {
  if (typeof window === "undefined") return;
  const at = Date.now();
  const channel = getChannel();
  if (channel) {
    try {
      channel.postMessage({ type: "logout", at } satisfies AuthEvent);
    } catch {
      // Channel kan vara stängd — fall genom till storage-fallback.
    }
  }
  // localStorage-fallback alltid. Andra tabs lyssnar på `storage`-event.
  // OBS: `storage`-eventet trigger:as INTE i den tab som skrev — bara
  // i andra tabs, vilket är exakt vad vi vill.
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // localStorage kan vara disabled (private-mode på Safari pre-15).
  }
}

/**
 * Hook som lyssnar på cross-tab logout-events och anropar `onLogout`.
 * Använd i alla autenticated layouts (portal, fundraising, club, etc).
 *
 * `onLogout` ska:
 *   - inte själv anropa POST /v1/auth/logout (sessionen är redan död)
 *   - rensa lokal cache / portal-context
 *   - navigera till /login (eller behålla nuvarande sida om publik)
 *
 * Hooken är safe att kalla mer än en gång per app (varje layout)
 * eftersom varje useEffect skapar sin egen listener och tar bort
 * den vid unmount.
 */
export function useCrossTabLogout(onLogout: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let stopped = false;
    const handler = () => {
      if (stopped) return;
      // Defer:a till microtask för att låta event-target's egna
      // state-uppdateringar (apiFetch, etc) flush:as innan vi navigerar.
      queueMicrotask(onLogout);
    };

    const channel = getChannel();
    if (channel) {
      channel.addEventListener("message", (ev) => {
        const data = ev.data as AuthEvent | undefined;
        if (data?.type === "logout") handler();
      });
    }

    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY && ev.newValue) handler();
    };
    window.addEventListener("storage", storageHandler);

    return () => {
      stopped = true;
      window.removeEventListener("storage", storageHandler);
      // Vi stänger inte channel:n här — singleton lever vidare och
      // listener tas bort när hela window tas ned.
    };
  }, [onLogout]);
}
