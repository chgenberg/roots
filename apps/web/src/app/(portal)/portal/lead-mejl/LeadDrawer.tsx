"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Pencil, Trash2, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal, btn, field } from "./Modal";
import { STATUS_STYLE, formatWhen, kr, type Lead } from "./types";

type Preview = {
  from: string;
  to: string;
  subject: string;
  html: string;
  missing: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  hasOverride: boolean;
};

const EDITABLE = new Set(["draft", "approved", "failed"]);

export function LeadDrawer({
  lead,
  statusLabels,
  onClose,
  onChanged,
  onDeleted,
}: {
  lead: Lead;
  statusLabels: Record<string, string>;
  onClose: () => void;
  onChanged: (lead: Lead) => void;
  onDeleted: (id: string) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [members, setMembers] = useState(lead.memberCount?.toString() ?? "");
  const [contact, setContact] = useState(lead.contactName ?? "");
  const [website, setWebsite] = useState(lead.website ?? "");
  const [note, setNote] = useState(lead.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const editable = EDITABLE.has(lead.status);

  const loadPreview = useCallback(async () => {
    const { ok, data } = await apiFetch<Preview>(`/v1/outreach/leads/${lead.id}/preview`);
    if (ok) {
      setPreview(data);
      setSubject(data.subjectTemplate);
      setBody(data.bodyTemplate);
    }
  }, [lead.id]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, lead]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const { ok, data } = await apiFetch<{ lead?: Lead; error?: string }>(`/v1/outreach/leads/${lead.id}`, {
      method: "PATCH",
      body,
    });
    setBusy(false);
    if (!ok || !data.lead) {
      setError(data.error ?? "Kunde inte spara.");
      return false;
    }
    onChanged(data.lead);
    return true;
  }

  async function approve() {
    setBusy(true);
    const { ok, data } = await apiFetch<{ approved: number }>("/v1/outreach/leads/approve", {
      method: "POST",
      body: { ids: [lead.id] },
    });
    setBusy(false);
    if (ok && data.approved === 1) {
      onChanged({ ...lead, status: "approved", approvedAt: new Date().toISOString(), lastError: null });
    } else setError("Mejlet kunde inte godkännas.");
  }

  async function remove() {
    if (!window.confirm(`Ta bort ${lead.orgName} från listan?`)) return;
    const { ok } = await apiFetch(`/v1/outreach/leads/${lead.id}`, { method: "DELETE" });
    if (ok) onDeleted(lead.id);
  }

  async function saveDetails() {
    const n = members.trim() ? Number(members.replace(/\s/g, "")) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1)) {
      setError("Antal medlemmar måste vara ett heltal.");
      return;
    }
    const changes: Record<string, unknown> = {};
    if (n !== lead.memberCount) changes.memberCount = n;
    if ((contact.trim() || null) !== lead.contactName) changes.contactName = contact.trim() || null;
    if ((website.trim() || null) !== lead.website) changes.website = website.trim() || null;
    if (Object.keys(changes).length) await patch(changes);
  }

  async function saveText() {
    if (await patch({ subjectOverride: subject, bodyOverride: body })) setEditing(false);
  }

  return (
    <Modal title={lead.orgName} onClose={onClose} side>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[lead.status])}>
            {statusLabels[lead.status] ?? lead.status}
          </span>
          {lead.sentAt && <span className="text-xs text-muted-foreground">Skickad {formatWhen(lead.sentAt)}</span>}
          {lead.proposalOpenCount > 0 && (
            <span className="text-xs font-medium text-success">
              Öppnat förslaget {lead.proposalOpenCount} {lead.proposalOpenCount === 1 ? "gång" : "gånger"}, senast{" "}
              {formatWhen(lead.proposalOpenedAt)}
            </span>
          )}
          <a
            href={lead.proposalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            Öppna förslaget <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        {lead.lastError && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{lead.lastError}</p>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Antal medlemmar</span>
            <input
              inputMode="numeric"
              value={members}
              disabled={!editable}
              onChange={(e) => setMembers(e.target.value)}
              className={field}
              placeholder="t.ex. 120"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Kontaktperson</span>
            <input value={contact} disabled={!editable} onChange={(e) => setContact(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Webbplats</span>
            <input value={website} disabled={!editable} onChange={(e) => setWebsite(e.target.value)} className={field} />
          </label>
          {editable && (
            <div className="sm:col-span-3">
              <button type="button" className={btn.ghost} disabled={busy} onClick={() => void saveDetails()}>
                Spara uppgifter
              </button>
              {lead.associationKr !== null && (
                <span className="ml-3 text-xs text-muted-foreground">
                  {lead.memberCount} × {kr(lead.packagesPerMember * lead.packagePriceKr)} = {kr(lead.totalKr!)} ·{" "}
                  {kr(lead.associationKr)} till föreningen
                </span>
              )}
            </div>
          )}
        </section>

        {preview && preview.missing.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-surface px-3 py-2 text-sm text-foreground ring-1 ring-inset ring-warning-edge">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {preview.missing.join(" · ")}. Mejlet kan inte godkännas förrän det är ifyllt.
          </p>
        )}

        <section className="overflow-hidden rounded-2xl ring-1 ring-inset ring-border">
          <div className="space-y-0.5 border-b border-border bg-muted/40 px-4 py-3 text-[13px]">
            <p>
              <span className="text-muted-foreground">Från: </span>
              {preview?.from}
            </p>
            <p>
              <span className="text-muted-foreground">Till: </span>
              {lead.email}
            </p>
            <p className="font-semibold text-foreground">{preview?.subject}</p>
          </div>
          {editing ? (
            <div className="space-y-3 p-4">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} aria-label="Ämnesrad" />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={22}
                className={`${field} font-mono text-[12.5px] leading-relaxed`}
                aria-label="Mejltext"
              />
              <p className="text-xs text-muted-foreground">
                Ändringen gäller bara {lead.orgName}. Fälten i hakparentes fylls i automatiskt.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn.primary} disabled={busy} onClick={() => void saveText()}>
                  Spara texten
                </button>
                <button type="button" className={btn.ghost} onClick={() => setEditing(false)}>
                  Avbryt
                </button>
              </div>
            </div>
          ) : preview ? (
            <iframe
              title={`Mejlet till ${lead.orgName}`}
              srcDoc={preview.html}
              sandbox=""
              className="h-[560px] w-full bg-white"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Laddar…</p>
          )}
        </section>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(lead.status === "draft" || lead.status === "failed") && (
            <button
              type="button"
              className={btn.primary}
              disabled={busy || !preview || preview.missing.length > 0}
              onClick={() => void approve()}
            >
              <Check className="h-4 w-4" /> Godkänn mejlet
            </button>
          )}
          {(lead.status === "approved" || lead.status === "failed") && (
            <button type="button" className={btn.ghost} disabled={busy} onClick={() => void patch({ status: "draft" })}>
              <Undo2 className="h-4 w-4" /> Gör om till utkast
            </button>
          )}
          {editable && !editing && (
            <button type="button" className={btn.ghost} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Ändra texten för {lead.orgName}
            </button>
          )}
          {editable && preview?.hasOverride && !editing && (
            <button
              type="button"
              className={btn.ghost}
              disabled={busy}
              onClick={() => void patch({ subjectOverride: null, bodyOverride: null })}
            >
              Använd avsändarens mall igen
            </button>
          )}
          {lead.sentAt &&
            (["replied", "meeting", "declined"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(btn.ghost, lead.status === s && "bg-inverse-surface text-inverse-on-surface")}
                disabled={busy || lead.status === s}
                onClick={() => void patch({ status: s })}
              >
                {statusLabels[s]}
              </button>
            ))}
          {!lead.sentAt && (
            <button type="button" className={cn(btn.danger, "ml-auto")} onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" /> Ta bort
            </button>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Anteckning</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (lead.note ?? "") && void patch({ note: note.trim() || null })}
            rows={3}
            className={field}
            placeholder="T.ex. ringde ordföranden, återkommer i november"
          />
        </label>
      </div>
    </Modal>
  );
}
