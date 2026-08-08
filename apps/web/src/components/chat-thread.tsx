"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

export interface ChatMessage {
  id: string;
  body: string;
  fromMe: boolean;
  isBroadcast: boolean;
  createdAt: string;
}

function formatTime(iso: string, dateLocale: string): string {
  try {
    return new Date(iso).toLocaleString(dateLocale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Presentational chat thread: message list + composer. Data and
 * polling are owned by the parent (seller or team-leader page).
 */
export function ChatThread({
  messages,
  onSend,
  loading,
  disabled,
  emptyText,
  placeholder,
}: {
  messages: ChatMessage[];
  onSend: (body: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  placeholder?: string;
}) {
  const { locale } = useLocale();
  const dateLocale = appCommon[locale].dateLocale;
  const chatDefaults = fundraisingPages.myShopChat[locale];
  const resolvedEmpty = emptyText ?? chatDefaults.empty;
  const resolvedPlaceholder = placeholder ?? chatDefaults.placeholder;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border bg-background">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {resolvedEmpty}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.fromMe
                    ? "bg-brand-700 text-primary-foreground"
                    : m.isBroadcast
                      ? "bg-brand-50 text-foreground ring-1 ring-brand-200"
                      : "bg-brand-100 text-foreground"
                }`}
              >
                {m.isBroadcast && !m.fromMe && (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                    {chatDefaults.broadcastBadge}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    m.fromMe ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  {formatTime(m.createdAt, dateLocale)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-end gap-2 border-t p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={resolvedPlaceholder}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={disabled || sending || !text.trim()}
          aria-label={chatDefaults.sendAria}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
