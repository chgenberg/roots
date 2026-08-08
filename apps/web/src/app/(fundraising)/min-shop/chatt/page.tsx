"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { ChatThread, type ChatMessage } from "@/components/chat-thread";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

interface SellerChatResponse {
  sellerId: string;
  teamId: string;
  messages: ChatMessage[];
}

export default function SellerChatPage() {
  const { locale } = useLocale();
  const t = fundraisingPages.myShopChat[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiFetch<SellerChatResponse>("/v1/chat/seller");
    if (ok && data?.messages) {
      setMessages(data.messages);
      if (!loadedOnce.current) {
        loadedOnce.current = true;
        apiFetch("/v1/chat/seller/read", { method: "POST", body: {} }).catch(
          () => {}
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function send(body: string) {
    const { ok, data } = await apiFetch<{ message: ChatMessage; error?: string }>(
      "/v1/chat/seller",
      { method: "POST", body: { body } }
    );
    if (ok && data?.message) {
      setMessages((prev) => [...prev, data.message]);
    } else {
      toast(data?.error || t.sendFailed, "error");
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-brand-500" />
            {t.conversation}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChatThread
            messages={messages}
            onSend={send}
            loading={loading}
            emptyText={t.empty}
            placeholder={t.placeholder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
