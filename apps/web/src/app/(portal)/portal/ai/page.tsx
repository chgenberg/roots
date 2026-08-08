"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Loader2, Sparkles, Bot, User, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortalUser } from "@/lib/portal-context";
import { getBrowserApiBase } from "@/lib/api-base";
import { getCsrfToken } from "@/lib/api";
import { useLocale } from "@/i18n/locale-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const API_URL = `${getBrowserApiBase()}/v1/ai/chat`;

type AiDict = (typeof portalPages)["ai"][Locale];

function getWelcomeMessage(
  role: string,
  name: string,
  t: AiDict
): string {
  switch (role) {
    case "CLUB_ADMIN":
    case "CLUB_MEMBER":
      return tFill(t.welcomeClub, { name });
    case "SALES_REP":
    case "SALES_ADMIN":
      return tFill(t.welcomeSales, { name });
    case "ASSOCIATION_ADMIN":
      return tFill(t.welcomeAssociation, { name });
    case "TEAM_LEADER":
      return tFill(t.welcomeTeamLeader, { name });
    case "SELLER":
      return tFill(t.welcomeSeller, { name });
    case "INTERNAL_ADMIN":
      return tFill(t.welcomeAdmin, { name });
    default:
      return tFill(t.welcomeDefault, { name });
  }
}

function buildWelcome(role: string, name: string, t: AiDict): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: getWelcomeMessage(role, name, t),
  };
}

function getSuggestions(role: string, t: AiDict): readonly string[] {
  switch (role) {
    case "CLUB_ADMIN":
    case "CLUB_MEMBER":
      return t.suggestionsClub;
    case "SALES_REP":
    case "SALES_ADMIN":
      return t.suggestionsSales;
    case "ASSOCIATION_ADMIN":
      return t.suggestionsAssociation;
    case "TEAM_LEADER":
      return t.suggestionsTeamLeader;
    case "SELLER":
      return t.suggestionsSeller;
    case "INTERNAL_ADMIN":
    default:
      return t.suggestionsAdmin;
  }
}

export default function AIPage() {
  const user = usePortalUser();
  const { locale } = useLocale();
  const t = portalPages.ai[locale];
  const firstName = user.name.split(" ")[0];

  const [messages, setMessages] = useState<Message[]>(() => [
    buildWelcome(user.role, firstName, t),
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggestions = useMemo(
    () => getSuggestions(user.role, t),
    [user.role, t]
  );

  useEffect(() => {
    setMessages([buildWelcome(user.role, firstName, t)]);
  }, [locale, user.role, firstName, t]);

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
    inputRef.current?.focus();
  }, []);

  function newConversation() {
    setMessages([buildWelcome(user.role, firstName, t)]);
    setInput("");
  }

  async function handleSend(override?: string) {
    const text = (override ?? input).trim();
    if (!text || streaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const history = messages.filter((m) => m.id !== "welcome");

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const csrf = await getCsrfToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-roots-locale": locale,
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          stream: true,
          locale,
          history: history.slice(-10).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || t.genericError
        );
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
                  const idx = updated.findIndex((m) => m.id === assistantId);
                  if (idx === -1) return prev;
                  updated[idx] = {
                    ...updated[idx],
                    content: accumulated,
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
          const idx = updated.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          if (!updated[idx].content) {
            updated[idx] = { ...updated[idx], content: t.aborted };
          }
          return updated;
        });
      } else {
        const errorMessage =
          err instanceof Error ? err.message : t.fallbackError;

        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          updated[idx] = {
            ...updated[idx],
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
    <div className="page-enter flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-inverse-surface to-brand-700 shadow-sm">
            <Sparkles className="h-5 w-5 text-inverse-on-surface" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 self-start rounded-xl"
          onClick={newConversation}
          disabled={streaming || messages.length <= 1}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t.newConversation}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={streaming}
            onClick={() => {
              setInput(s);
              void handleSend(s);
            }}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label={t.conversationAria}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden="true">
                  <Bot className="h-4 w-4 text-brand-400" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-br-md bg-inverse-surface text-inverse-on-surface"
                    : "rounded-bl-md bg-brand-50 text-foreground"
                )}
              >
                {msg.content ||
                  (streaming &&
                  msg.id === messages[messages.length - 1]?.id &&
                  msg.role === "assistant" ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      <span>{t.thinking}</span>
                    </span>
                  ) : null)}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inverse-surface" aria-hidden="true">
                  <User className="h-4 w-4 text-inverse-on-surface" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder}
              rows={1}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={streaming}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover"
                aria-label={t.stopAria}
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface transition-all duration-200 hover:bg-inverse-surface-hover disabled:opacity-40"
                aria-label={t.sendAria}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {t.disclaimer}
          </p>
        </div>
      </Card>
    </div>
  );
}
