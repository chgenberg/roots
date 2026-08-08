"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Users } from "lucide-react";
import { ChatThread, type ChatMessage } from "@/components/chat-thread";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface Thread {
  sellerId: string;
  displayName: string;
  unread: number;
}

export default function LeaderChatPage() {
  const { locale } = useLocale();
  const t = fundraisingPages.teamChat[locale];
  const c = fundraisingPages.common[locale];
  const [teamId, setTeamId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const { toast } = useToast();
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  const loadThreads = useCallback(async (tid: string) => {
    const { ok, data } = await apiFetch<{ threads: Thread[] }>(
      `/v1/chat/team/${tid}/threads`
    );
    if (ok && data?.threads) setThreads(data.threads);
  }, []);

  const loadMessages = useCallback(
    async (tid: string, sellerId: string, markRead = false) => {
      const { ok, data } = await apiFetch<{ messages: ChatMessage[] }>(
        `/v1/chat/team/${tid}/seller/${sellerId}`
      );
      if (ok && data?.messages) setMessages(data.messages);
      if (markRead) {
        await apiFetch(`/v1/chat/team/${tid}/read`, {
          method: "POST",
          body: { sellerId },
        }).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    async function init() {
      const { ok, data } = await apiFetch<{ teamId: string }>(
        "/v1/dashboard/my-team"
      );
      if (ok && data?.teamId) {
        setTeamId(data.teamId);
        await loadThreads(data.teamId);
      }
      setLoading(false);
    }
    init();
  }, [loadThreads]);

  // Poll threads + open thread.
  useEffect(() => {
    if (!teamId) return;
    const id = setInterval(() => {
      loadThreads(teamId);
      if (selectedRef.current) loadMessages(teamId, selectedRef.current);
    }, 15000);
    return () => clearInterval(id);
  }, [teamId, loadThreads, loadMessages]);

  async function openThread(sellerId: string) {
    setSelected(sellerId);
    setMessages([]);
    if (teamId) {
      await loadMessages(teamId, sellerId, true);
      setThreads((prev) =>
        prev.map((t) => (t.sellerId === sellerId ? { ...t, unread: 0 } : t))
      );
    }
  }

  async function send(body: string) {
    if (!teamId || !selected) return;
    const { ok, data } = await apiFetch<{ message: ChatMessage; error?: string }>(
      `/v1/chat/team/${teamId}`,
      { method: "POST", body: { body, recipientSellerId: selected } }
    );
    if (ok && data?.message) {
      setMessages((prev) => [...prev, data.message]);
    } else {
      toast(data?.error || t.sendFailed, "error");
    }
  }

  async function sendBroadcast() {
    const body = broadcast.trim();
    if (!teamId || !body) return;
    setSendingBroadcast(true);
    const { ok, data } = await apiFetch<{ error?: string }>(
      `/v1/chat/team/${teamId}`,
      { method: "POST", body: { body } }
    );
    setSendingBroadcast(false);
    if (ok) {
      toast(t.broadcastOk, "success");
      setBroadcast("");
      setBroadcastOpen(false);
    } else {
      toast(data?.error || t.sendFailed, "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {c.noTeamFound}
      </div>
    );
  }

  const selectedName = threads.find((t) => t.sellerId === selected)?.displayName;

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <Button variant="outline" onClick={() => setBroadcastOpen((v) => !v)}>
          <Megaphone className="mr-2 h-4 w-4" />
          {t.broadcast}
        </Button>
      </div>

      {broadcastOpen && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">{t.broadcastTitle}</p>
            <textarea
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
              rows={3}
              placeholder={t.broadcastPlaceholder}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBroadcastOpen(false)}>
                {c.cancel}
              </Button>
              <Button
                onClick={sendBroadcast}
                disabled={sendingBroadcast || !broadcast.trim()}
              >
                {sendingBroadcast && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t.sendAll}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardContent className="p-2">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t.noSellers}
              </p>
            ) : (
              <div className="space-y-1">
                {threads.map((t) => (
                  <button
                    key={t.sellerId}
                    type="button"
                    onClick={() => openThread(t.sellerId)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      selected === t.sellerId
                        ? "bg-brand-100 font-medium"
                        : "hover:bg-brand-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="h-4 w-4 shrink-0 text-brand-400" />
                      <span className="truncate">{t.displayName}</span>
                    </span>
                    {t.unread > 0 && (
                      <Badge className="bg-brand-700 text-primary-foreground">
                        {t.unread}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {selected ? (
            <>
              <p className="mb-2 text-sm font-medium">{selectedName}</p>
              <ChatThread
                messages={messages}
                onSend={send}
                emptyText={tFill(t.emptyThread, { name: selectedName ?? t.sellerFallback })}
                placeholder={tFill(t.placeholder, { name: selectedName ?? t.sellerFallback })}
              />
            </>
          ) : (
            <Card className="flex h-[60vh] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {t.pickSeller}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
