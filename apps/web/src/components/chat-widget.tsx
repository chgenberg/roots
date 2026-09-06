"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Square,
  RotateCcw,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserApiBase } from "@/lib/api-base";
import { getCsrfToken, rootsFetch } from "@/lib/api";
import { useLocale } from "@/i18n/locale-context";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";
import { LocaleLink } from "@/components/locale-link";
import { withLocale } from "@/i18n/paths";

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
const STORAGE_KEY = "roots.publicChat.v1";

/** Map suggestion chips that imply navigation to a path instead of chat. */
const SUGGESTION_ROUTES: Record<string, string> = {
  "Starta gratis håranalys": "/haranalys",
  "Start a free hair analysis": "/haranalys",
};

function storageKey(locale: string) {
  return `${STORAGE_KEY}.${locale}`;
}

function loadStoredMessages(locale: string, welcome: string): Message[] {
  if (typeof window === "undefined") {
    return [{ role: "assistant", content: welcome }];
  }
  try {
    const raw = sessionStorage.getItem(storageKey(locale));
    if (!raw) return [{ role: "assistant", content: welcome }];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ role: "assistant", content: welcome }];
    }
    return parsed.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
  } catch {
    return [{ role: "assistant", content: welcome }];
  }
}

function persistMessages(locale: string, messages: Message[]) {
  try {
    sessionStorage.setItem(storageKey(locale), JSON.stringify(messages));
  } catch {
    // Quota / private mode — ignore.
  }
}

/** Render assistant text with clickable internal paths and mailto/https links. */
function MessageBody({
  text,
  locale,
}: {
  text: string;
  locale: "sv" | "en";
}) {
  const parts = useMemo(() => {
    const pattern =
      /(\bhttps?:\/\/[^\s<]+|\bmailto:[^\s<]+|\/(?:en\/)?[a-z0-9][\w\-./?=&%#]*)/gi;
    const out: Array<{ type: "text" | "link"; value: string }> = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        out.push({ type: "text", value: text.slice(last, match.index) });
      }
      out.push({ type: "link", value: match[0] });
      last = match.index + match[0].length;
    }
    if (last < text.length) out.push({ type: "text", value: text.slice(last) });
    return out.length ? out : [{ type: "text" as const, value: text }];
  }, [text]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.value}</span>;
        const href = part.value;
        if (href.startsWith("http") || href.startsWith("mailto:")) {
          return (
            <a
              key={i}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="font-medium underline underline-offset-2 hover:text-brand-800"
            >
              {href.replace(/^mailto:/, "")}
            </a>
          );
        }
        // Internal path — strip accidental leading /en for LocaleLink
        const path = href.replace(/^\/en(?=\/)/, "") || "/";
        return (
          <LocaleLink
            key={i}
            href={path}
            className="font-medium underline underline-offset-2 hover:text-brand-800"
          >
            {withLocale(path, locale)}
          </LocaleLink>
        );
      })}
    </span>
  );
}

export function ChatWidget() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const t = marketingUi[locale].chat;
  const aboveMobileBuyBar = /\/produkter\/[^/]+/.test(
    (pathname || "").replace(/^\/en(?=\/|$)/, "")
  );
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: "assistant", content: t.welcome },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate from sessionStorage once per locale.
  useEffect(() => {
    const stored = loadStoredMessages(locale, t.welcome);
    setMessages(stored);
    hydratedRef.current = true;
  }, [locale, t.welcome]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    persistMessages(locale, messages);
  }, [locale, messages]);

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

  // Lock body scroll while open.
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
        const dialog = document.querySelector<HTMLElement>(
          `[role="dialog"][aria-label="${t.dialogLabel}"]`
        );
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, textarea, input, a[href], [tabindex]:not([tabindex="-1"])'
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
  }, [open, t.dialogLabel]);

  const hasUserTurns = messages.some((m) => m.role === "user");

  function clearChat() {
    stop();
    const next: Message[] = [{ role: "assistant", content: t.welcome }];
    setMessages(next);
    setInput("");
    try {
      sessionStorage.removeItem(storageKey(locale));
    } catch {
      // ignore
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || streaming) return;

    // Special-case chips that should navigate instead of chatting.
    const route = SUGGESTION_ROUTES[text];
    if (route) {
      window.location.href = withLocale(route, locale);
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    const history = messages.filter(
      (m) => !(m.role === "assistant" && m.content === t.welcome)
    );

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const csrf = await getCsrfToken();
      const res = await rootsFetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          stream: true,
          history: history.slice(-10),
          locale,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || t.error);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error(t.noResponse);

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
                accumulated =
                  parsed.replace === true
                    ? parsed.content
                    : accumulated + parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: accumulated,
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
              content: t.aborted,
            };
          }
          return updated;
        });
      } else {
        const errorMessage =
          err instanceof Error ? err.message : t.error;

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
      void sendMessage(input);
    }
  }

  const overlay =
    open && mounted
      ? createPortal(
          <>
            {/* Strong focus backdrop — dim + blur the whole page */}
            <div
              className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-md transition-opacity duration-200 supports-[backdrop-filter]:bg-black/45"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Dialog */}
            <div
              className={cn(
                "fixed z-[90] flex flex-col overflow-hidden border-border bg-background shadow-[var(--shadow-dialog)] transition-all duration-200",
                "inset-x-0 bottom-0 h-[min(88vh,720px)] max-h-[88vh] rounded-t-2xl border-t pb-[max(0px,env(safe-area-inset-bottom))]",
                "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[min(640px,calc(100vh-4rem))] sm:max-h-none sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:pb-0",
                "translate-y-0 opacity-100 sm:scale-100"
              )}
              role="dialog"
              aria-modal="true"
              aria-label={t.dialogLabel}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Roots AI</h2>
                  <p className="text-xs text-muted-foreground">{t.subtitle}</p>
                </div>
                <div className="flex items-center gap-1">
                  {hasUserTurns ? (
                    <button
                      type="button"
                      onClick={clearChat}
                      disabled={streaming}
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      aria-label={t.clearAria}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.clear}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t.close}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
                role="log"
                aria-live="polite"
                aria-atomic="false"
                aria-label={t.history}
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
                            ? "rounded-bl-sm border border-warning-edge bg-warning-surface text-warning-strong"
                            : "rounded-bl-sm bg-brand-50 text-foreground"
                      )}
                    >
                      {msg.role === "assistant" && msg.fallback ? (
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-warning-strong">
                          {t.unavailable}
                        </p>
                      ) : null}
                      {msg.content ? (
                        msg.role === "assistant" ? (
                          <MessageBody text={msg.content} locale={locale} />
                        ) : (
                          <span className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </span>
                        )
                      ) : streaming && i === messages.length - 1 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Loader2
                            className="h-3 w-3 animate-spin"
                            aria-hidden="true"
                          />
                          <span>{t.thinking}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}

                {!hasUserTurns && !streaming ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t.suggestionsLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {t.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t.contactHint}</span>
                  <LocaleLink
                    href="/kontakt"
                    className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {t.contactCta}
                  </LocaleLink>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.placeholder}
                    rows={1}
                    className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={streaming}
                  />
                  {streaming ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover"
                      aria-label={t.stop}
                    >
                      <Square className="h-4 w-4" fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendMessage(input)}
                      disabled={!input.trim()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover disabled:opacity-40"
                      aria-label={t.send}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t.disclaimer}
                </p>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {overlay}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6",
          aboveMobileBuyBar
            ? "bottom-[5.75rem]"
            : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
          "bg-inverse-surface text-inverse-on-surface",
          open && "pointer-events-none opacity-0"
        )}
        aria-label={open ? t.close : t.open}
        aria-hidden={open ? "true" : undefined}
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </>
  );
}
