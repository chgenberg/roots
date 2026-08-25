"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Msg = { id: string; role: string; body: string; imageUrls: string[] };

type Item = {
  id: string;
  title: string;
  status: string;
  cursorPrompt: string;
  updatedAt: string;
  fromName: string;
  messages: Msg[];
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mediaSrc(url: string): string {
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("/v1/")) return `/api${url}`;
  return url;
}

export function AdminFeedbackClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { ok, data } = await apiFetch<{ threads?: Item[] }>("/v1/admin/feedback");
    if (!ok) {
      setLoading(false);
      return;
    }
    const list = data.threads ?? [];
    setItems(list);
    setOpenId((cur) => cur ?? list.find((i) => i.status === "submitted")?.id ?? list[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function copy(item: Item) {
    try {
      await navigator.clipboard.writeText(item.cursorPrompt);
      setCopied(item.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* private mode */
    }
  }

  async function markDone(id: string) {
    const { ok } = await apiFetch("/v1/admin/feedback", {
      method: "PATCH",
      body: { id, action: "done" },
    });
    if (!ok) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "done" } : i)));
  }

  const open = items.find((i) => i.id === openId) ?? null;
  const inbox = items.filter((i) => i.status === "submitted").length;

  return (
    <>
      <header className="mb-6">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Feedback
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {inbox
            ? `${inbox} ${inbox === 1 ? "ny att kopiera" : "nya att kopiera"}`
            : "Prompten från granskaren hamnar här när hen klickar Skicka."}
        </p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Laddar…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-background p-10 text-center ring-1 ring-inset ring-border">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-[15px] font-semibold text-foreground">Inget skickat än</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            När granskaren skickar en färdig ändring syns promptet här.
          </p>
        </div>
      ) : (
        <div className="mt-2 grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    item.id === openId
                      ? "bg-inverse-surface text-inverse-on-surface"
                      : "hover:bg-background"
                  }`}
                >
                  <p className="truncate text-sm font-medium">{item.title || "Utan titel"}</p>
                  <p
                    className={`mt-0.5 text-xs ${
                      item.id === openId ? "text-inverse-on-surface/70" : "text-muted-foreground"
                    }`}
                  >
                    {item.fromName} · {formatWhen(item.updatedAt)}
                    {item.status === "submitted" ? " · Ny" : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {open && (
            <article className="rounded-2xl bg-background p-5 ring-1 ring-inset ring-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {open.title || "Utan titel"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {open.fromName} · {formatWhen(open.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copy(open)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-inverse-surface px-3 text-[13px] font-semibold text-inverse-on-surface"
                  >
                    {copied === open.id ? (
                      <>
                        <Check className="h-4 w-4" /> Kopierad
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Kopiera prompt
                      </>
                    )}
                  </button>
                  {open.status === "submitted" && (
                    <button
                      type="button"
                      onClick={() => void markDone(open.id)}
                      className="inline-flex h-9 items-center rounded-full bg-background px-3 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-border"
                    >
                      Markera som klar
                    </button>
                  )}
                </div>
              </div>

              <pre className="mt-5 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-sans text-sm leading-relaxed text-foreground">
                {open.cursorPrompt}
              </pre>

              {open.messages.length > 0 && (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Visa chatten
                  </summary>
                  <div className="mt-3 space-y-3">
                    {open.messages.map((m) => (
                      <div key={m.id} className="text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {m.role === "user" ? open.fromName : "Agenten"}
                        </p>
                        {m.imageUrls.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {m.imageUrls.map((src) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={src}
                                src={mediaSrc(src)}
                                alt=""
                                className="max-h-28 rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </article>
          )}
        </div>
      )}
    </>
  );
}
