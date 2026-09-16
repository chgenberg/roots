"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  DESK_ACTIONS,
  DESK_FLOW_STEPS,
  DESK_ROLES,
  SITE_EVENTS,
  type DeskRoleKey,
} from "@/lib/orchestrator/desk-map";

const STEP_MS = 1700;

export function AdminDeskMap() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [picked, setPicked] = useState<DeskRoleKey | null>(null);

  const current = DESK_FLOW_STEPS[step] ?? DESK_FLOW_STEPS[0];
  const focus = picked ? DESK_ROLES.find((r) => r.key === picked) : null;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStep((prev) => (prev + 1) % DESK_FLOW_STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-background">
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Live
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
              Så jobbar de anställda
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Fem bord. Varje anställd vaktar en del av Roots. Markeringen är
              steget just nu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm"
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {playing ? "Pausa" : "Spela"}
          </button>
        </div>

        <ol className="flex flex-wrap gap-2">
          {DESK_FLOW_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setPicked(null);
                  setPlaying(false);
                }}
                className={`rounded-full px-3 py-1.5 text-[13px] ${
                  i === step
                    ? "bg-brand-700 text-white"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <p className="text-sm text-muted-foreground">{current.note}</p>

        <div className="grid gap-3 sm:grid-cols-5">
          {DESK_ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() =>
                setPicked((prev) => (prev === role.key ? null : role.key))
              }
              className={`rounded-2xl border px-3 py-3 text-left ${
                current.hot === "desks" || picked === role.key
                  ? "border-brand-700 bg-brand-50"
                  : "border-border"
              }`}
            >
              <p className="text-sm font-medium">{role.name}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {focus?.key === role.key ? role.does : role.watches}
              </p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
          <p>
            Händelser:{" "}
            {SITE_EVENTS.map((e) => e.label).join(" · ")}
          </p>
          <p>
            Gör: {DESK_ACTIONS.map((a) => a.label).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}
