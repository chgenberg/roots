"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, X } from "lucide-react";
import { apiFetch, getCsrfToken, rootsFetch } from "@/lib/api";
import { ReviewerShell } from "./ReviewerShell";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  body: string;
  imageUrls: string[];
};

type Thread = {
  id: string;
  title: string;
  status: string;
};

type Pending = { id: string; file: File; preview: string; url?: string };

function mediaSrc(url: string): string {
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("/v1/")) return `/api${url}`;
  return url;
}

export function ReviewerChat({ name }: { name: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { ok, data } = await apiFetch<{ thread: Thread | null; messages: ChatMsg[] }>(
      "/v1/reviewer/thread"
    );
    if (!ok) return;
    setThread(data.thread);
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, sending, thread?.status]);

  async function newChat() {
    if (busy) return;
    const { ok, data } = await apiFetch<{ thread: Thread; messages: ChatMsg[] }>(
      "/v1/reviewer/thread",
      { method: "POST" }
    );
    if (!ok) return;
    setThread(data.thread);
    setMessages([]);
    setDraft("");
    setPending([]);
  }

  async function attachFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 4);
    for (const file of list) {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      const preview = URL.createObjectURL(file);
      setPending((prev) => [...prev, { id, file, preview }].slice(0, 4));
      const form = new FormData();
      form.append("file", file);
      try {
        const csrf = await getCsrfToken();
        const res = await rootsFetch("/api/v1/reviewer/upload", {
          method: "POST",
          headers: { "x-csrf-token": csrf },
          body: form,
        });
        if (!res.ok) {
          setPending((prev) => prev.filter((p) => p.id !== id));
          continue;
        }
        const uploaded = (await res.json()) as { url?: string };
        if (!uploaded.url) {
          setPending((prev) => prev.filter((p) => p.id !== id));
          continue;
        }
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, url: uploaded.url } : p)));
      } catch {
        setPending((prev) => prev.filter((p) => p.id !== id));
      }
    }
  }

  async function send() {
    const text = draft.trim();
    const urls = pending.map((p) => p.url).filter((u): u is string => Boolean(u));
    const uploading = pending.some((p) => !p.url);
    if (busy || uploading || (!text && urls.length === 0)) return;
    setBusy(true);
    setDraft("");
    const localImages = pending.map((p) => p.preview);
    setPending([]);
    const userMsg: ChatMsg = {
      id: `local-${Date.now()}`,
      role: "user",
      body: text,
      imageUrls: urls.length ? urls : localImages,
    };
    setMessages((m) => [...m, userMsg]);
    try {
      const { ok, data } = await apiFetch<{
        thread?: Thread;
        message?: ChatMsg;
        error?: string;
      }>("/v1/reviewer/turn", {
        method: "POST",
        body: { threadId: thread?.id, text, imageUrls: urls },
      });
      if (!ok || !data.message) {
        setMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            body:
              data.error === "RATE_LIMITED"
                ? "Vänta en stund och försök igen."
                : "Något gick fel. Försök igen.",
            imageUrls: [],
          },
        ]);
        return;
      }
      if (data.thread) setThread(data.thread);
      setMessages((m) => [...m, data.message!]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  async function submit() {
    if (!thread?.id || sending || busy) return;
    setSending(true);
    try {
      const { ok, data } = await apiFetch<{
        thread?: Thread;
        message?: ChatMsg;
        error?: string;
      }>("/v1/reviewer/submit", {
        method: "POST",
        body: { threadId: thread.id },
      });
      if (!ok) {
        setMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            body:
              data.error === "RATE_LIMITED"
                ? "Vänta en stund och försök igen."
                : "Kunde inte skicka just nu. Försök igen.",
            imageUrls: [],
          },
        ]);
        return;
      }
      if (data.thread) setThread(data.thread);
      if (data.message) setMessages((m) => [...m, data.message!]);
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0 && !busy;
  const firstName = name.split(" ")[0] || "där";
  const closed = thread?.status === "submitted" || thread?.status === "done";
  const userTurns = messages.filter((m) => m.role === "user").length;
  const canSubmit = !closed && userTurns >= 1 && (thread?.status === "ready" || userTurns >= 2);

  return (
    <ReviewerShell name={name} onNewChat={messages.length > 0 ? newChat : undefined}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4">
        <div className="flex-1 overflow-y-auto py-8">
          {empty ? (
            <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Vad ska vi ändra?
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Hej {firstName}. Skriv feedback eller klistra in en skärmdump. Agenten
                ställer följdfrågor tills det är tydligt.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <article
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] space-y-2 ${
                      m.role === "user"
                        ? "rounded-2xl bg-inverse-surface px-4 py-3 text-inverse-on-surface"
                        : "text-foreground"
                    }`}
                  >
                    {m.imageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.imageUrls.map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={src}
                            src={mediaSrc(src)}
                            alt=""
                            className="max-h-40 rounded-xl object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {m.body && (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</p>
                    )}
                  </div>
                </article>
              ))}
              {busy && <p className="text-sm text-muted-foreground">Agenten läser…</p>}
              {sending && <p className="text-sm text-muted-foreground">Skickar…</p>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-brand-50/40 pb-4 pt-2">
          {closed ? (
            <div className="rounded-3xl border border-border bg-background px-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Skickat. Starta en ny chatt om något mer ska ändras.
              </p>
              <button
                type="button"
                onClick={() => void newChat()}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-inverse-surface px-4 text-sm font-semibold text-inverse-on-surface"
              >
                Ny chatt
              </button>
            </div>
          ) : (
            <>
              {canSubmit && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    När det stämmer — skicka så hamnar det hos Christopher.
                  </p>
                  <button
                    type="button"
                    disabled={sending || busy}
                    onClick={() => void submit()}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-inverse-surface px-4 text-sm font-semibold text-inverse-on-surface disabled:opacity-40"
                  >
                    {sending ? "Skickar…" : "Skicka"}
                  </button>
                </div>
              )}
              {pending.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pending.map((p) => (
                    <div key={p.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
                      <button
                        type="button"
                        onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                        className="absolute -right-1 -top-1 rounded-full bg-inverse-surface p-0.5 text-inverse-on-surface"
                        aria-label="Ta bort"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="rounded-3xl border border-border bg-background p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={(e) => {
                    const files = Array.from(e.clipboardData.files).filter((f) =>
                      f.type.startsWith("image/")
                    );
                    if (files.length) {
                      e.preventDefault();
                      void attachFiles(files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Berätta vad som ska ändras…"
                  className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] text-foreground outline-none"
                />
                <div className="flex items-center justify-between px-1 pb-0.5">
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) void attachFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Bifoga skärmdump"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      pending.some((p) => !p.url) ||
                      (!draft.trim() && pending.filter((p) => p.url).length === 0)
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface disabled:opacity-30"
                    aria-label="Skicka meddelande"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </ReviewerShell>
  );
}
