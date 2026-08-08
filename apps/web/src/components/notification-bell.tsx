"use client";

/**
 * NotificationBell — Sprint E11.
 *
 * Header-level inbox that all logged-in roles share. Data source is
 * `GET /v1/notifications` which projects role-relevant events (new
 * orders, paid invoices, claimed team invites, lead-creates, high-
 * signal audit events) into a unified feed.
 *
 * Unread state is purely client-side:
 *   localStorage["roots.notifications.lastReadAt"] = ISO string.
 * Anything with `createdAt > lastReadAt` shows as unread until the
 * dropdown is opened (which writes a fresh stamp).
 *
 * We deliberately don't persist read-state server-side yet — the
 * audit told us this is a P1 inbox, not a critical workflow, so the
 * localStorage approach keeps us out of a schema migration. When we
 * later move to a real per-user notifications table the FE only
 * needs to swap `lastReadAt` for an API call.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, X, Sparkles, Inbox } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { useLocale } from "@/i18n/locale-context";

const API_URL = getBrowserApiBase();
const STORAGE_KEY = "roots.notifications.lastReadAt";
const POLL_MS = 60_000;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
}

function readLastReadAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function writeLastReadAt(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

function relativeTime(iso: string, locale: "sv" | "en"): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return appCommon[locale].justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString(appCommon[locale].dateLocale, {
    month: "short",
    day: "numeric",
  });
}

export default function NotificationBell() {
  const { locale } = useLocale();
  const c = appCommon[locale];
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLastReadAt(readLastReadAt());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rootsFetch(`${API_URL}/v1/notifications`);
      if (res.ok) {
        const j = (await res.json()) as { items: NotificationItem[] };
        setItems(j.items ?? []);
      }
    } catch {
      // Header bells must never break the page. Swallow + leave list as-is.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const unreadCount = useMemo(() => {
    return items.filter((i) => new Date(i.createdAt).getTime() > lastReadAt)
      .length;
  }, [items, lastReadAt]);

  function handleOpen() {
    const wasOpen = open;
    setOpen(!wasOpen);
    if (!wasOpen) {
      writeLastReadAt();
      setLastReadAt(Date.now());
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={c.notifications}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-bell-popover"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-900 px-1 text-[10px] font-bold text-brand-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-bell-popover"
          role="dialog"
          aria-label={c.notifications}
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border bg-background shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand-600" />
              <p className="text-sm font-semibold">{c.notifications}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={c.notificationsClose}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {c.loading}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {c.notificationsEmpty}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((it) => {
                  const isUnread =
                    new Date(it.createdAt).getTime() > lastReadAt;
                  const inner = (
                    <div
                      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-brand-50 ${
                        isUnread ? "bg-brand-50/40" : ""
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isUnread ? "bg-brand-600" : "bg-transparent"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">
                          {it.title}
                        </p>
                        {it.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {it.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {relativeTime(it.createdAt, locale)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={it.id}>
                      {it.href ? (
                        <LocaleLink href={it.href} onClick={() => setOpen(false)}>
                          {inner}
                        </LocaleLink>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
