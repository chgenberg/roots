"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserApiBase } from "@/lib/api-base";

interface Message {
  role: "user" | "assistant";
  content: string;
  // Scout fix 2026-05-26 (AI-HIGH-06): markera fallback-svar så UI:t
  // kan visa amber-banner istället för att rendera det som vanligt
  // AI-svar (matchar hair-analysis-dialogens UX).
  fallback?: boolean;
}

const BASE_API = getBrowserApiBase();
const API_URL = `${BASE_API}/v1/ai/public-chat`;

let _csrfCache: string | null = null;
async function getCsrf(): Promise<string> {
  if (_csrfCache) return _csrfCache;
  const r = await fetch(`${BASE_API}/v1/csrf-token`, { credentials: "include" });
  const d = await r.json();
  _csrfCache = d.token;
  return _csrfCache!;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hej! Jag är Roots AI-assistent. Fråga mig vad som helst om våra produkter, föreningssamarbeten eller leveranser.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // P3.71 (audit 2026-05-26): tidigare kunde användaren på mobil
  // scrolla sidan bakom bottom-sheet:en eftersom vi inte lockade
  // body-scroll. Pattern speglar header-mobilmenyn som redan gör det.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Roots AI-chatt"]');
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, textarea, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const history = messages.filter((m) => m !== WELCOME_MESSAGE);

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const csrf = await getCsrf();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          stream: true,
          history: history.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Något gick fel."
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Ingen respons.");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: accumulated,
                    // Scout fix 2026-05-26 (AI-HIGH-06): backend
                    // skickar fallback:true i SSE-payload när AI är
                    // off / upstream-fel. Vi visar då en amber-
                    // banner kring meddelandet.
                    fallback: parsed.fallback === true,
                  };
                  return updated;
                });
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Avbrutet.",
            };
          }
          return updated;
        });
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Något gick fel. Försök igen eller kontakta hej@roots.se.";

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: errorMessage,
          };
          return updated;
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dialog */}
      {/* MASTERPLAN_01 KC6.3: bottom-sheet på mobil.
          ≤ sm: full bredd, slidar upp från botten, 85vh hög, rounded
                bara på top-hörnen, pb=safe-area så home-indikatorn
                inte täcker input.
          ≥ sm: oförändrad centrerad dialog (samma som tidigare).
          Skälet: tum-zonen på en hand-held iPhone når inte mitten på
          skärmen. Bottom-sheet ger 0–95% touch-area + känns native
          (samma pattern som iOS share-sheet, Maps, Instagram comments). */}
      <div
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-border bg-background shadow-[var(--shadow-dialog)] transition-all duration-200",
          // Mobile: full-width bottom-sheet, 85vh hög, safe-area-padding
          // via Tailwind arbitrary value på pb (matchar (marketing)/produkter
          // sticky-CTA-mönstret från KC6.2).
          "inset-x-0 bottom-0 h-[85vh] max-h-[85vh] rounded-t-2xl border-t pb-[max(0px,env(safe-area-inset-bottom))]",
          // Desktop (sm+): centered dialog (override mobile positioning)
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[min(580px,calc(100vh-4rem))] sm:max-h-none sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:pb-0",
          open
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "pointer-events-none translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Roots AI-chatt"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Roots AI</h2>
            <p className="text-xs text-muted-foreground">
              Fråga oss vad som helst
            </p>
          </div>
          {/* MASTERPLAN_01 KC6.1: 44x44 touch-target. Tidigare 32x32
              riskerade mis-tap på iPhone där hela widgeten är bredvid
              tumzonen. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Stäng chatt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        {/* MASTERPLAN_01 KC6.9: aria-live så att skärmläsare hör nya
            AI-svar när de strömmas in. "polite" avbryter inte
            pågående screen-reader-output. aria-atomic=false så bara
            de nya delarna läses upp, inte hela historiken igen. */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Chatt-historik"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-br-sm bg-inverse-surface text-inverse-on-surface"
                    : msg.fallback
                      ? "rounded-bl-sm border border-amber-300 bg-amber-50 text-amber-900"
                      : "rounded-bl-sm bg-brand-50 text-foreground"
                )}
              >
                {/* Scout fix 2026-05-26 (AI-HIGH-06): visa explicit
                    fallback-flagga så användaren förstår att svaret
                    är en generisk hänvisning, inte AI:n som är på. */}
                {msg.role === "assistant" && msg.fallback ? (
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700">
                    AI är tillfälligt otillgänglig
                  </p>
                ) : null}
                {msg.content ||
                  (streaming && i === messages.length - 1 ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      <span>Tänker...</span>
                    </span>
                  ) : null)}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv ditt meddelande..."
              rows={1}
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={streaming}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover"
                aria-label="Stoppa generering"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover disabled:opacity-40"
                aria-label="Skicka meddelande"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* P2.49 (audit 2026-05-26): tidigare 10 px text på 60 %
              opacity var oläsligt — i praktiken en dold disclaimer
              vilket är problematiskt (AI-svar måste vara tydligt
              markerade). Använder vanlig muted-foreground och text-xs. */}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            AI-genererat svar — verifiera viktig information
          </p>
        </div>
      </div>

      {/* Floating trigger button */}
      {/* P2.48 (audit 2026-05-26): tidigare låg FAB på z-50 vilket
          gjorde att den hamnade ovanpå bottom-sheets, sticky kassa-
          CTA och dialog-overlays. Sänker till z-30 så att den ligger
          under modaler men över vanlig innehåll. Vi gömmer den också
          medan chat-dialogen är öppen så den inte täcker stäng-knappen. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95",
          "bg-inverse-surface text-inverse-on-surface",
          open && "pointer-events-none opacity-0 sm:opacity-100 sm:pointer-events-auto sm:z-[60]"
        )}
        aria-label={open ? "Stäng chatt" : "Öppna chatt"}
        aria-hidden={open ? "true" : undefined}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
