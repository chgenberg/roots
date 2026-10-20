"use client";

import { useEffect, useState } from "react";
import { Check, Mail, Reply } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  emailed: boolean;
  handledAt: string | null;
  createdAt: string;
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

export function ContactMessagesSection() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHandled, setShowHandled] = useState(false);

  useEffect(() => {
    void (async () => {
      const { ok, data } = await apiFetch<{ messages?: ContactMessage[] }>(
        "/v1/admin/contact-messages"
      );
      if (ok) setItems(data.messages ?? []);
      setLoading(false);
    })();
  }, []);

  async function setHandled(id: string, handled: boolean) {
    const { ok } = await apiFetch("/v1/admin/contact-messages", {
      method: "PATCH",
      body: { id, handled },
    });
    if (!ok) return;
    setItems((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, handledAt: handled ? new Date().toISOString() : null } : m
      )
    );
  }

  const open = items.filter((m) => !m.handledAt);
  const handled = items.filter((m) => m.handledAt);
  const visible = showHandled ? items : open;

  return (
    <section className="mt-12">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Kontaktformuläret
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {loading
              ? "Laddar…"
              : open.length
                ? `${open.length} ${open.length === 1 ? "obesvarat meddelande" : "obesvarade meddelanden"}`
                : "Alla meddelanden är hanterade."}
          </p>
        </div>
        {handled.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHandled((v) => !v)}
            className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {showHandled ? "Dölj hanterade" : `Visa hanterade (${handled.length})`}
          </button>
        )}
      </header>

      {!loading && visible.length === 0 ? (
        <div className="rounded-2xl bg-background p-8 text-center ring-1 ring-inset ring-border">
          <Mail className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nya meddelanden från /kontakt hamnar här.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => (
            <li
              key={m.id}
              className={`rounded-2xl bg-background p-5 ring-1 ring-inset ring-border ${
                m.handledAt ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{m.subject}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {m.name} · {m.email} · {formatWhen(m.createdAt)}
                    {m.locale === "en" ? " · engelska" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Sv: ${m.subject}`)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-inverse-surface px-3 text-[13px] font-semibold text-inverse-on-surface"
                  >
                    <Reply className="h-4 w-4" /> Svara
                  </a>
                  <button
                    type="button"
                    onClick={() => void setHandled(m.id, !m.handledAt)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-border"
                  >
                    <Check className="h-4 w-4" />
                    {m.handledAt ? "Ångra hanterad" : "Markera som hanterad"}
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {m.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
