"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal, btn, field } from "./Modal";
import type { Sender } from "./types";

const FIELDS = [
  "[Förnamn]",
  "[Föreningsnamn]",
  "[Antal säljande medlemmar]",
  "[Försäljning per medlem]",
  "[Total försäljning]",
  "[Framräknad behållning]",
  "[kort beskrivning av antagandena]",
  "[Se förslaget för Föreningsnamn]",
  "[Avsändare]",
  "[Titel]",
  "[Telefonnummer]",
  "[E-postadress]",
];

export function SenderForm({
  sender,
  canManage,
  onClose,
  onSaved,
}: {
  sender: Sender | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(sender?.name ?? "");
  const [title, setTitle] = useState(sender?.title ?? "Föreningsrepresentant");
  const [phone, setPhone] = useState(sender?.phone ?? "");
  const [email, setEmail] = useState(sender?.email ?? "");
  const [dailyCap, setDailyCap] = useState(String(sender?.dailyCap ?? 40));
  const [userEmail, setUserEmail] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState(sender?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(sender?.bodyTemplate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const cap = Number(dailyCap);
    const payload: Record<string, unknown> = {
      name,
      title,
      phone: phone.trim() || null,
      email,
      dailyCap: Number.isInteger(cap) ? cap : 40,
    };
    if (sender) {
      payload.subjectTemplate = subjectTemplate;
      payload.bodyTemplate = bodyTemplate;
    }
    if (canManage && userEmail.trim()) payload.userEmail = userEmail.trim();
    const { ok, data } = await apiFetch<{ sender?: { id: string }; error?: string }>(
      sender ? `/v1/outreach/senders/${sender.id}` : "/v1/outreach/senders",
      { method: sender ? "PATCH" : "POST", body: payload }
    );
    setBusy(false);
    if (!ok || !data.sender) {
      setError(data.error ?? "Kunde inte spara.");
      return;
    }
    onSaved(data.sender.id);
  }

  return (
    <Modal title={sender ? `Avsändare och mall – ${sender.name}` : "Ny avsändare"} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Namn</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Niclas Corse" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Titel</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              E-post (avsändare, svaren hamnar här)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="niclas@roots.nu"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="070-123 45 67" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Max antal mejl per dag</span>
            <input inputMode="numeric" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} className={field} />
          </label>
          {canManage && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Säljarkonto som får se listan (valfritt)
              </span>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className={field}
                placeholder={sender?.userId ? "Kopplat — fyll i för att byta" : "e-post för säljarens inloggning"}
              />
            </label>
          )}
        </div>

        {sender ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Ämnesrad</span>
              <input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Mejltext</span>
              <textarea
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={20}
                className={`${field} font-mono text-[12.5px] leading-relaxed`}
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Fält som fylls i automatiskt. Tom rad mellan stycken, punkter börjar med •.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FIELDS.map((f) => (
                  <code key={f} className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] text-foreground">
                    {f}
                  </code>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Den nya avsändaren får Niclas text som mall. Du kan ändra den efteråt, t.ex. raden om
            Folkspel.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void save()}>
            {busy ? "Sparar…" : "Spara"}
          </button>
          <button type="button" className={btn.ghost} onClick={onClose}>
            Avbryt
          </button>
        </div>
      </div>
    </Modal>
  );
}
