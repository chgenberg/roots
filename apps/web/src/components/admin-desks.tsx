"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  CADENCE_LABELS,
  CONDUCTOR_CADENCES,
  hireFigures,
  parseCadence,
  portraitSrc,
  ringBoxRem,
  ringColRem,
  seatStyle,
  type ConductorCadence,
} from "@roots/contracts";
import { ideasForDesk, ideasForGroup } from "@/lib/orchestrator/desk-ideas";

type DeskRule = {
  id: string;
  title: string;
  enabled: boolean;
  trigger: string;
  action: string;
  gate: string;
  approvedAt: string | null;
  lastRanAt: string | null;
  cadence: ConductorCadence;
};

type DeskMessage = {
  id: string;
  role: "you" | "agent";
  text: string;
  createdAt: string;
  deskId?: string | null;
  name?: string | null;
  image?: string | null;
};

type Desk = {
  id: string;
  key: string;
  name: string;
  blurb: string;
  accent: string;
  portrait?: number;
  image?: string;
  seeded: boolean;
  waiting: number;
  on: number;
  rules: DeskRule[];
  messages: DeskMessage[];
};

function DeskRuleCard(props: {
  rule: DeskRule;
  busy: string | null;
  onApprove: () => void;
  onToggle: () => void;
  onRun: () => void;
  onCadence: (cadence: ConductorCadence) => void;
  onRemove: () => void;
}) {
  const { rule } = props;
  return (
    <li className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-sm font-medium leading-snug">{rule.title}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {!rule.approvedAt
          ? "Utkast — körs inte"
          : rule.enabled
            ? "Uppgift på"
            : "Uppgift av"}
        {rule.gate === "irreversible" || rule.gate === "money"
          ? " · Pengar"
          : ""}
        {rule.gate === "email" ? " · Mejl" : ""}
        {rule.lastRanAt
          ? ` · Senast ${new Date(rule.lastRanAt).toLocaleString("sv-SE")}`
          : ""}
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Hur ofta
        </span>
        <select
          value={parseCadence(rule.cadence)}
          disabled={props.busy === rule.id}
          aria-label="Hur ofta uppdraget kikar"
          onChange={(e) => props.onCadence(parseCadence(e.target.value))}
          className="h-9 w-full rounded-full border border-border bg-background px-3 text-[13px]"
        >
          {CONDUCTOR_CADENCES.map((id) => (
            <option key={id} value={id}>
              {CADENCE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!rule.approvedAt ? (
          <button
            type="button"
            disabled={props.busy === rule.id}
            onClick={props.onApprove}
            className="h-9 rounded-full bg-brand-700 px-3.5 text-[13px] text-white disabled:opacity-50"
          >
            Godkänn och slå på
          </button>
        ) : (
          <button
            type="button"
            disabled={props.busy === rule.id}
            onClick={props.onToggle}
            className="h-9 rounded-full border border-border px-3.5 text-[13px] disabled:opacity-50"
          >
            {rule.enabled ? "Slå av" : "Slå på"}
          </button>
        )}
        {rule.approvedAt && rule.enabled ? (
          <button
            type="button"
            disabled={props.busy === `run-${rule.id}`}
            onClick={props.onRun}
            className="h-9 rounded-full border border-border px-3.5 text-[13px] disabled:opacity-50"
          >
            Kör nu
          </button>
        ) : null}
        <button
          type="button"
          disabled={props.busy === rule.id}
          onClick={props.onRemove}
          className="h-9 rounded-full px-3 text-[13px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Ta bort
        </button>
      </div>
    </li>
  );
}

function IdeasBar(props: {
  ideas: string[];
  open: boolean;
  onToggle: () => void;
  onPick: (text: string) => void;
  hint: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">
          {props.hint}
        </p>
        <button
          type="button"
          aria-expanded={props.open}
          aria-label="Förslag"
          onClick={props.onToggle}
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
            props.open
              ? "bg-brand-50 text-brand-700"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <HelpCircle className="size-4" aria-hidden />
        </button>
      </div>
      {props.open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {props.ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => props.onPick(idea)}
              className="max-w-full rounded-full border border-border bg-muted px-3 py-1.5 text-left text-[12px] leading-snug hover:border-brand-700"
            >
              {idea}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminDesks() {
  const [desks, setDesks] = useState<Desk[]>([]);
  const [groupMessages, setGroupMessages] = useState<DeskMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState(false);
  const [openHire, setOpenHire] = useState(false);
  const [hireName, setHireName] = useState("");
  const [hireFigure, setHireFigure] = useState<number | null>(null);
  const [availableFigures, setAvailableFigures] = useState<number[]>([]);
  const [showIdeas, setShowIdeas] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameEdit, setNameEdit] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmRule, setConfirmRule] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const greeted = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await apiFetch<{
      desks?: Desk[];
      missing?: boolean;
      figures?: { available?: number[] };
      group?: { messages?: DeskMessage[] };
    }>("/v1/admin/conductor-desks");
    if (!res.ok) return;
    setMissing(Boolean(res.data.missing));
    if (res.data.desks) setDesks(res.data.desks);
    setAvailableFigures(
      res.data.figures?.available ??
        hireFigures((res.data.desks ?? []).map((d) => d.portrait ?? 0))
    );
    if (res.data.group?.messages) setGroupMessages(res.data.group.messages);
  }, []);

  useEffect(() => {
    void load();
    setMounted(true);
  }, [load]);

  const open = desks.find((d) => d.id === openId) ?? null;

  useEffect(() => {
    if (open) setNameEdit(open.name);
    setShowIdeas(false);
  }, [open]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [openId, openGroup, desks, groupMessages]);

  useEffect(() => {
    if (!openId || greeted.current.has(openId)) return;
    const desk = desks.find((d) => d.id === openId);
    if (!desk || desk.messages.length > 0) return;
    greeted.current.add(openId);
    void apiFetch(`/v1/admin/conductor-desks/${openId}/chat`, {
      method: "POST",
      body: { greet: true },
    }).then(() => load());
  }, [openId, desks, load]);

  useEffect(() => {
    if (!openGroup || greeted.current.has("group")) return;
    if (groupMessages.length > 0) return;
    greeted.current.add("group");
    void apiFetch("/v1/admin/conductor-desks/group", {
      method: "POST",
      body: { greet: true },
    }).then(() => load());
  }, [openGroup, groupMessages.length, load]);

  useEffect(() => {
    if (!openId && !openGroup && !openHire) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setConfirmRule(null);
      setConfirmRemove(false);
      setOpenId(null);
      setOpenGroup(false);
      setOpenHire(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId, openGroup, openHire]);

  function closeDialog() {
    setConfirmRule(null);
    setConfirmRemove(false);
    setOpenId(null);
    setOpenGroup(false);
    setOpenHire(false);
  }

  async function sendChat() {
    const text = draft.trim();
    if (!open || text.length < 2) return;
    setBusy("chat");
    setDraft("");
    try {
      const res = await apiFetch(`/v1/admin/conductor-desks/${open.id}/chat`, {
        method: "POST",
        body: { text },
      });
      if (!res.ok) {
        setDraft(text);
        return;
      }
      await load();
    } catch {
      setDraft(text);
    } finally {
      setBusy(null);
    }
  }

  async function sendGroup() {
    const text = draft.trim();
    if (text.length < 2) return;
    setBusy("chat");
    setDraft("");
    try {
      const res = await apiFetch("/v1/admin/conductor-desks/group", {
        method: "POST",
        body: { text },
      });
      if (!res.ok) {
        setDraft(text);
        return;
      }
      await load();
    } catch {
      setDraft(text);
    } finally {
      setBusy(null);
    }
  }

  async function runRule(id: string) {
    setBusy(`run-${id}`);
    try {
      await apiFetch(`/v1/admin/conductor-rules/${id}/run`, {
        method: "POST",
        body: {},
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function hire() {
    const name = hireName.trim();
    if (!name || !hireFigure) return;
    setBusy("hire");
    try {
      const res = await apiFetch<{ desk?: Desk }>("/v1/admin/conductor-desks", {
        method: "POST",
        body: { name, portrait: hireFigure },
      });
      if (res.ok && res.data.desk) {
        setOpenHire(false);
        setHireName("");
        setHireFigure(null);
        await load();
        setOpenId(res.data.desk.id);
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveName() {
    if (!open || !nameEdit.trim() || nameEdit.trim() === open.name) return;
    await apiFetch(`/v1/admin/conductor-desks/${open.id}`, {
      method: "PATCH",
      body: { name: nameEdit.trim() },
    });
    await load();
  }

  async function removeDesk() {
    if (!open) return;
    setBusy("remove");
    try {
      await apiFetch(`/v1/admin/conductor-desks/${open.id}`, {
        method: "DELETE",
      });
      setConfirmRemove(false);
      setOpenId(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function patchRule(id: string, action: "approve" | "toggle") {
    setBusy(id);
    try {
      await apiFetch(`/v1/admin/conductor-rules/${id}`, {
        method: "PATCH",
        body: { action },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function setCadence(id: string, cadence: ConductorCadence) {
    setBusy(id);
    try {
      await apiFetch(`/v1/admin/conductor-rules/${id}`, {
        method: "PATCH",
        body: { action: "cadence", cadence },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removeRule() {
    if (!confirmRule) return;
    setBusy(confirmRule.id);
    try {
      await apiFetch(`/v1/admin/conductor-rules/${confirmRule.id}`, {
        method: "DELETE",
      });
      setConfirmRule(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const count = desks.length;
  const box = ringBoxRem(count);
  const col = ringColRem(count);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-background">
      <div className="px-5 pt-5 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Anställda
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          Agenten och de anställda
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Samma figurer som i Billboard. Klicka en anställd för att utbilda
          hen. Utan ditt ja går inget irreversibelt ut.
        </p>
      </div>

      {missing ? (
        <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
          Tabellerna för ringen saknas ännu. Starta om API:t så körs
          migrationen.
        </p>
      ) : (
        <div className="relative mx-auto my-6 aspect-square w-[min(100%,28rem)] sm:w-[32rem]">
          {desks.map((desk, i) => {
            const pos = seatStyle(i, Math.max(count, 1));
            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => setOpenId(desk.id)}
                style={{ left: pos.left, top: pos.top, width: `${col.base}rem` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              >
                <span
                  className="mx-auto flex items-end justify-center overflow-hidden rounded-2xl bg-brand-50"
                  style={{ height: `${box.base}rem` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={desk.image ?? portraitSrc(desk.portrait ?? i + 1)}
                    alt=""
                    className="h-[88%] w-auto max-w-[72%] object-contain object-bottom"
                  />
                </span>
                <span className="mt-1.5 block truncate text-[13px] font-medium">
                  {desk.name}
                </span>
                {desk.waiting > 0 ? (
                  <span className="text-[11px] text-brand-700">
                    {desk.waiting} utkast
                  </span>
                ) : desk.on > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    {desk.on} på
                  </span>
                ) : null}
              </button>
            );
          })}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenGroup(true)}
              className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white"
            >
              Alla
            </button>
            <button
              type="button"
              onClick={() => {
                setHireFigure(availableFigures[0] ?? null);
                setOpenHire(true);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px]"
            >
              <Plus className="size-3.5" />
              Anställ
            </button>
          </div>
        </div>
      )}

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:p-6"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDialog();
              }}
            >
              <div className="flex h-[min(56rem,94dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-background shadow-lg">
                <div className="flex items-start gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-brand-50 sm:h-16 sm:w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={open.image ?? portraitSrc(open.portrait ?? 1)}
                      alt=""
                      className="h-full w-full object-cover object-[50%_18%]"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={nameEdit}
                      onChange={(e) => setNameEdit(e.target.value)}
                      onBlur={() => void saveName()}
                      className="w-full bg-transparent text-xl font-semibold leading-tight outline-none"
                    />
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {open.blurb}
                    </p>
                    <IdeasBar
                      ideas={ideasForDesk(open)}
                      open={showIdeas}
                      onToggle={() => setShowIdeas((v) => !v)}
                      onPick={(text) => setDraft(text)}
                      hint="Säg vad hen ska göra. Jag frågar tills jag har det jag behöver."
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {!open.seeded ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(true)}
                        className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Ta bort
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Stäng"
                      onClick={closeDialog}
                      className="-mr-1 rounded-full p-2 text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
                  <div className="flex min-h-[16rem] min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
                    <div
                      ref={threadRef}
                      className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
                    >
                      {open.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}
                        >
                          <p
                            className={`max-w-[34rem] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              m.role === "you"
                                ? "rounded-br-md bg-brand-700 text-white"
                                : "rounded-bl-md bg-muted"
                            }`}
                          >
                            {m.text}
                          </p>
                        </div>
                      ))}
                    </div>
                    <form
                      className="flex items-center gap-2 border-t border-border px-3 py-3 sm:px-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void sendChat();
                      }}
                    >
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Meddelande till anställd</span>
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Säg vad jag ska göra."
                          className="h-11 w-full rounded-full border border-border bg-muted px-4 text-sm outline-none focus:border-brand-700"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={draft.trim().length < 2 || busy === "chat"}
                        className="h-11 shrink-0 rounded-full bg-brand-700 px-5 text-sm text-white disabled:opacity-40"
                      >
                        Skicka
                      </button>
                    </form>
                  </div>
                  <div className="min-w-0 overflow-y-auto bg-muted/40 px-4 py-4 sm:px-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Uppdrag
                    </p>
                    {open.rules.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Inga uppdrag än. Skriv i chatten.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {open.rules.map((rule) => (
                          <DeskRuleCard
                            key={rule.id}
                            rule={rule}
                            busy={busy}
                            onApprove={() => void patchRule(rule.id, "approve")}
                            onToggle={() => void patchRule(rule.id, "toggle")}
                            onRun={() => void runRule(rule.id)}
                            onCadence={(cadence) =>
                              void setCadence(rule.id, cadence)
                            }
                            onRemove={() =>
                              setConfirmRule({ id: rule.id, title: rule.title })
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && open && confirmRemove
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
              <div className="w-full max-w-md rounded-[28px] bg-background p-6">
                <p className="text-xl font-semibold">
                  Är du säker på att du vill ta bort den agenten?
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="h-11 rounded-full border border-border px-5 text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    disabled={busy === "remove"}
                    onClick={() => void removeDesk()}
                    className="h-11 rounded-full bg-brand-700 px-5 text-sm text-white"
                  >
                    Radera
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && confirmRule
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
              <div className="w-full max-w-md rounded-[28px] bg-background p-6">
                <p className="text-xl font-semibold">Ta bort uppdraget?</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {confirmRule.title}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRule(null)}
                    className="h-11 rounded-full border border-border px-5 text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeRule()}
                    className="h-11 rounded-full bg-brand-700 px-5 text-sm text-white"
                  >
                    Radera
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && openGroup
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDialog();
              }}
            >
              <div className="flex h-[min(40rem,90dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-background shadow-lg">
                <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                  <span className="flex h-14 items-center">
                    {desks.slice(0, 3).map((desk, i) => (
                      <span
                        key={desk.id}
                        className={`size-10 overflow-hidden rounded-full bg-brand-50 ring-2 ring-background ${
                          i === 0 ? "" : "-ml-3"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={desk.image ?? portraitSrc(desk.portrait ?? i + 1)}
                          alt=""
                          className="size-full object-cover object-[50%_12%]"
                        />
                      </span>
                    ))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold">Alla anställda</h3>
                    <IdeasBar
                      ideas={ideasForGroup()}
                      open={showIdeas}
                      onToggle={() => setShowIdeas((v) => !v)}
                      onPick={(text) => setDraft(text)}
                      hint="Säg vad gruppen ska göra. Rätt bord tar det."
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Stäng"
                    onClick={closeDialog}
                    className="rounded-full p-2 text-muted-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div
                  ref={threadRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                  {groupMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}
                    >
                      <p
                        className={`max-w-[34rem] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                          m.role === "you"
                            ? "bg-brand-700 text-white"
                            : "bg-muted"
                        }`}
                      >
                        {m.name && m.role === "agent" ? (
                          <span className="mb-1 block text-[11px] font-medium opacity-70">
                            {m.name}
                          </span>
                        ) : null}
                        {m.text}
                      </p>
                    </div>
                  ))}
                </div>
                <form
                  className="flex items-center gap-2 border-t border-border px-4 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendGroup();
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Säg vad ni ska göra."
                    className="h-11 min-w-0 flex-1 rounded-full border border-border bg-muted px-4 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={draft.trim().length < 2}
                    className="h-11 rounded-full bg-brand-700 px-5 text-sm text-white disabled:opacity-40"
                  >
                    Skicka
                  </button>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && openHire
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDialog();
              }}
            >
              <div className="w-full max-w-lg rounded-[28px] bg-background p-6">
                <h3 className="text-xl font-semibold">Anställ en agent</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Välj figur och ge hen ett namn. Du utbildar hen i chatten.
                </p>
                <label className="mt-4 block text-sm">
                  Namn
                  <input
                    value={hireName}
                    onChange={(e) => setHireName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-full border border-border px-4"
                  />
                </label>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {availableFigures.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setHireFigure(n)}
                      className={`overflow-hidden rounded-2xl bg-brand-50 ring-2 ${
                        hireFigure === n
                          ? "ring-brand-700"
                          : "ring-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={portraitSrc(n)}
                        alt={`Figur ${n}`}
                        className="h-24 w-full object-contain object-bottom"
                      />
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="h-11 rounded-full border border-border px-5 text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    disabled={!hireName.trim() || !hireFigure || busy === "hire"}
                    onClick={() => void hire()}
                    className="h-11 rounded-full bg-brand-700 px-5 text-sm text-white disabled:opacity-40"
                  >
                    Anställ
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
