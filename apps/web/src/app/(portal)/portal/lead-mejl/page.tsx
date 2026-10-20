"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Plus, Search, Send, Settings2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./ImportDialog";
import { LeadDrawer } from "./LeadDrawer";
import { SenderForm } from "./SenderForm";
import { btn } from "./Modal";
import { STATUS_STYLE, formatWhen, hostOf, kr, type Lead, type LeadStatus, type SendersResponse } from "./types";

const FILTERS: { id: LeadStatus | "all"; label: string }[] = [
  { id: "all", label: "Alla" },
  { id: "draft", label: "Utkast" },
  { id: "approved", label: "Godkända" },
  { id: "sent", label: "Skickade" },
  { id: "replied", label: "Har svarat" },
  { id: "meeting", label: "Möte bokat" },
  { id: "declined", label: "Inte intresserade" },
  { id: "failed", label: "Misslyckades" },
];

export default function LeadMailPage() {
  const [meta, setMeta] = useState<SendersResponse | null>(null);
  const [senderId, setSenderId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [dialog, setDialog] = useState<"import" | "sender" | "newSender" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const sender = meta?.senders.find((s) => s.id === senderId) ?? null;
  const labels = meta?.statusLabels ?? {};

  const loadMeta = useCallback(async (preferId?: string) => {
    const { ok, status, data } = await apiFetch<SendersResponse>("/v1/outreach/senders");
    if (!ok) {
      setLoadError(status === 403 ? "Du har inte behörighet till lead-mejlen." : "Kunde inte hämta avsändarna.");
      setLoading(false);
      return;
    }
    setMeta(data);
    setSenderId((cur) => preferId ?? (cur && data.senders.some((s) => s.id === cur) ? cur : data.senders[0]?.id ?? null));
    if (data.senders.length === 0) setLoading(false);
  }, []);

  const loadLeads = useCallback(async () => {
    if (!senderId) return;
    const p = new URLSearchParams();
    if (filter !== "all") p.set("status", filter);
    if (qDebounced) p.set("q", qDebounced);
    const { ok, data } = await apiFetch<{ leads: Lead[]; total: number }>(
      `/v1/outreach/senders/${senderId}/leads?${p.toString()}`
    );
    if (ok) {
      setLeads(data.leads);
      setTotal(data.total);
    }
    setLoading(false);
  }, [senderId, filter, qDebounced]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setSelected(new Set());
    void loadLeads();
  }, [loadLeads]);

  const refreshAll = useCallback(() => {
    void loadMeta();
    void loadLeads();
  }, [loadMeta, loadLeads]);

  const counts = sender?.counts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const approvedCount = counts.approved ?? 0;
  const remainingToday = sender ? Math.max(0, sender.dailyCap - sender.sentToday) : 0;
  const opened = leads.filter((l) => l.proposalOpenCount > 0).length;

  const selectable = useMemo(
    () => leads.filter((l) => (l.status === "draft" || l.status === "failed") && l.missing.length === 0),
    [leads]
  );

  async function approveSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const { ok, data } = await apiFetch<{ approved: number; skipped: number }>("/v1/outreach/leads/approve", {
      method: "POST",
      body: { ids },
    });
    if (ok) {
      setNotice(
        `${data.approved} mejl godkända${data.skipped ? ` · ${data.skipped} kunde inte godkännas (saknar uppgifter eller redan skickade)` : ""}.`
      );
      setSelected(new Set());
      refreshAll();
    }
  }

  async function sendApproved() {
    if (!sender) return;
    setConfirmSend(false);
    setSending(true);
    let sentTotal = 0;
    let failedTotal = 0;
    for (let round = 0; round < 20; round++) {
      const { ok, data } = await apiFetch<{
        sent?: number;
        failed?: number;
        more?: boolean;
        capReached?: boolean;
        error?: string;
      }>(`/v1/outreach/senders/${sender.id}/send`, { method: "POST" });
      if (!ok) {
        setNotice(data.error ?? "Utskicket avbröts.");
        break;
      }
      sentTotal += data.sent ?? 0;
      failedTotal += data.failed ?? 0;
      setNotice(`Skickar… ${sentTotal} skickade hittills.`);
      if (!data.more) {
        setNotice(
          `${sentTotal} mejl skickade${failedTotal ? ` · ${failedTotal} misslyckades` : ""}${
            data.capReached ? " · dagens tak är nått, resten går att skicka i morgon" : ""
          }.`
        );
        break;
      }
    }
    setSending(false);
    refreshAll();
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loadError) {
    return <p className="rounded-2xl bg-background p-8 text-center text-sm text-muted-foreground ring-1 ring-inset ring-border">{loadError}</p>;
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Försäljning</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground sm:text-[32px]">Lead-mejl</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            Importera en lista med föreningar, granska varje mejl och skicka från avsändarens egen adress.
            Agenten fyller i namn, räkneexempel och en förslagslänk med föreningens logotyp. Svaren hamnar
            direkt i avsändarens inkorg.
          </p>
        </div>
        {sender && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.ghost} onClick={() => setDialog("import")}>
              <Upload className="h-4 w-4" /> Importera Excel
            </button>
            <a href={`/api/v1/outreach/senders/${sender.id}/export`} className={btn.ghost}>
              <Download className="h-4 w-4" /> Ladda ner Excel
            </a>
          </div>
        )}
      </header>

      {meta && !meta.emailEnabled && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl bg-warning-surface px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-warning-edge">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Utskick är pausade.</strong> Du kan importera, granska och godkänna mejl. Inget skickas
            förrän mejl är påslaget (Resend med roots.nu som verifierad domän).
          </span>
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {meta?.senders.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === senderId}
            onClick={() => {
              setSenderId(s.id);
              setFilter("all");
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              s.id === senderId
                ? "bg-inverse-surface text-inverse-on-surface"
                : "bg-background text-foreground ring-1 ring-inset ring-border hover:bg-muted"
            )}
          >
            {s.name}
          </button>
        ))}
        {sender && (
          <button type="button" className={btn.ghost} onClick={() => setDialog("sender")}>
            <Settings2 className="h-4 w-4" /> Avsändare och mall
          </button>
        )}
        {meta?.canManage && (
          <button type="button" className={btn.ghost} onClick={() => setDialog("newSender")}>
            <Plus className="h-4 w-4" /> Ny avsändare
          </button>
        )}
      </div>

      {meta && meta.senders.length === 0 && (
        <div className="rounded-2xl bg-background p-10 text-center ring-1 ring-inset ring-border">
          <Send className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-semibold text-foreground">Börja med att lägga till en avsändare</p>
          <p className="mt-1 text-sm text-muted-foreground">
            T.ex. Niclas eller Kent, med namn, titel, telefon och roots.nu-adress. Sedan importerar du deras lista.
          </p>
        </div>
      )}

      {sender && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Föreningar i listan", value: allCount },
              { label: "Godkända, väntar på utskick", value: approvedCount },
              { label: "Skickade", value: (counts.sent ?? 0) + (counts.replied ?? 0) + (counts.meeting ?? 0) + (counts.declined ?? 0) },
              { label: "Möte bokat", value: counts.meeting ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-background p-4 ring-1 ring-inset ring-border">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value.toLocaleString("sv-SE")}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f.id === "all" ? allCount : (counts[f.id] ?? 0);
              if (f.id !== "all" && f.id !== "draft" && n === 0) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    filter === f.id
                      ? "bg-inverse-surface text-inverse-on-surface"
                      : "bg-background text-foreground ring-1 ring-inset ring-border hover:bg-muted"
                  )}
                >
                  {f.label} · {n.toLocaleString("sv-SE")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Sök förening, kontakt eller e-post</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Sök förening, kontakt eller e-post"
                className="h-9 w-full rounded-full bg-background pl-9 pr-4 text-sm text-foreground ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button type="button" className={btn.ghost} disabled={selected.size === 0} onClick={() => void approveSelected()}>
              <Check className="h-4 w-4" /> Godkänn valda{selected.size ? ` (${selected.size})` : ""}
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {sender.sentToday} av {sender.dailyCap} skickade i dag
              </span>
              <button
                type="button"
                className={btn.primary}
                disabled={!meta?.emailEnabled || approvedCount === 0 || sending || remainingToday === 0}
                title={!meta?.emailEnabled ? "Utskick är pausade" : undefined}
                onClick={() => setConfirmSend(true)}
              >
                <Send className="h-4 w-4" />
                {sending ? "Skickar…" : `Skicka godkända (${Math.min(approvedCount, remainingToday)})`}
              </button>
            </div>
          </div>

          {confirmSend && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-100/70 px-4 py-3 text-sm ring-1 ring-inset ring-border">
              <span className="text-foreground">
                Skicka {Math.min(approvedCount, remainingToday)} mejl från{" "}
                <strong>
                  {sender.name} &lt;{sender.email}&gt;
                </strong>
                ? Det går inte att ångra.
              </span>
              <button type="button" className={btn.primary} onClick={() => void sendApproved()}>
                Ja, skicka
              </button>
              <button type="button" className={btn.ghost} onClick={() => setConfirmSend(false)}>
                Avbryt
              </button>
            </div>
          )}

          {notice && (
            <p className="mt-3 text-sm text-foreground" role="status">
              {notice}
            </p>
          )}

          <p className="mt-4 text-[13px] text-muted-foreground">
            {loading
              ? "Laddar…"
              : `${total.toLocaleString("sv-SE")} föreningar${total > leads.length ? ` · visar ${leads.length}, de med medlemsantal först. Sök för att hitta fler` : ""}${
                  opened ? ` · ${opened} har öppnat förslaget` : ""
                }`}
          </p>

          <div className="mt-2 overflow-x-auto rounded-2xl bg-background ring-1 ring-inset ring-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Välj alla som kan godkännas"
                      checked={selectable.length > 0 && selectable.every((l) => selected.has(l.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((l) => l.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Förening</th>
                  <th className="px-3 py-3 font-semibold">Kontakt</th>
                  <th className="px-3 py-3 text-right font-semibold">Medlemmar</th>
                  <th className="px-3 py-3 text-right font-semibold">Till föreningen</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Förslaget</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const canSelect = selectable.includes(l);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setOpenLead(l)}
                      className="cursor-pointer border-b border-border align-top last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Välj ${l.orgName}`}
                          disabled={!canSelect}
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" className="text-left font-semibold text-foreground underline-offset-2 hover:underline">
                          {l.orgName}
                        </button>
                        {hostOf(l.website) && <div className="mt-0.5 text-xs text-muted-foreground">{hostOf(l.website)}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-foreground">{l.contactName || "—"}</div>
                        <div className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">{l.email}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {l.memberCount ?? <span className="text-xs font-medium text-destructive">Saknas</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {l.associationKr !== null ? kr(l.associationKr) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[l.status])}>
                          {labels[l.status] ?? l.status}
                        </span>
                        {l.sentAt && <div className="mt-0.5 text-xs text-muted-foreground">{formatWhen(l.sentAt)}</div>}
                        {l.hasOverride && <div className="mt-0.5 text-xs text-muted-foreground">Egen text</div>}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {l.proposalOpenCount > 0 ? (
                          <span className="font-medium text-success">
                            Öppnat {l.proposalOpenCount}× · {formatWhen(l.proposalOpenedAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      {allCount === 0
                        ? "Inga föreningar än. Importera en Excel-lista för att komma igång."
                        : "Inga föreningar i urvalet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dialog === "import" && sender && (
        <ImportDialog senderId={sender.id} senderName={sender.name} onClose={() => setDialog(null)} onDone={refreshAll} />
      )}
      {(dialog === "sender" || dialog === "newSender") && (
        <SenderForm
          sender={dialog === "sender" ? sender : null}
          canManage={meta?.canManage ?? false}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            void loadMeta(id);
            void loadLeads();
          }}
        />
      )}
      {openLead && (
        <LeadDrawer
          lead={openLead}
          statusLabels={labels}
          onClose={() => setOpenLead(null)}
          onChanged={(l) => {
            setOpenLead(l);
            setLeads((prev) => prev.map((x) => (x.id === l.id ? l : x)));
            void loadMeta();
          }}
          onDeleted={(id) => {
            setOpenLead(null);
            setLeads((prev) => prev.filter((x) => x.id !== id));
            void loadMeta();
          }}
        />
      )}
    </>
  );
}
