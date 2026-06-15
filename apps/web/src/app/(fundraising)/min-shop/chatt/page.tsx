"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { ChatThread, type ChatMessage } from "@/components/chat-thread";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface SellerChatResponse {
  sellerId: string;
  teamId: string;
  messages: ChatMessage[];
}

export default function SellerChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiFetch<SellerChatResponse>("/v1/chat/seller");
    if (ok && data?.messages) {
      setMessages(data.messages);
      // Markera som läst (best-effort) första gången.
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
      toast(data?.error || "Kunde inte skicka meddelandet.", "error");
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chatt med laget</h1>
        <p className="text-sm text-muted-foreground">
          Skriv direkt till din lagledare. Meddelanden till hela laget visas
          markerade.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-brand-500" />
            Konversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChatThread
            messages={messages}
            onSend={send}
            loading={loading}
            emptyText="Inga meddelanden ännu. Säg hej till din lagledare!"
            placeholder="Skriv till din lagledare…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
