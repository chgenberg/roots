"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Target,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  ChevronDown,
  LayoutGrid,
  List,
  GripVertical,
} from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import {
  pipelineResponseSchema,
  updateQuoteStatusResponseSchema,
  type PipelineDealKind,
} from "@roots/contracts";
import { formatKr } from "@/lib/format";
import {
  ALL_STAGES,
  STAGE_LABELS,
  daysSince,
  dropIntent,
  stageBadgeVariant,
  stageIndex,
} from "@/lib/pipeline-stages";
import {
  PipelineDealDialog,
  type PipelineDealRef,
} from "@/components/pipeline-deal-dialog";
import { NyOffertDialog } from "@/components/ny-offert-dialog";

const LEAD_SOURCES = [
  { value: "INBOUND", label: "Inkommande (förfrågan)" },
  { value: "OUTBOUND", label: "Utgående (kallt samtal)" },
  { value: "EVENT", label: "Mässa / event" },
  { value: "REFERRAL", label: "Rekommendation" },
  { value: "WEB", label: "Webbplats" },
  { value: "MANUAL", label: "Manuellt skapad" },
] as const;

const VIEW_STORAGE_KEY = "roots.pipeline.view";

interface BoardDeal {
  id: string;
  kind: PipelineDealKind;
  status: string;
  orgId: string;
  orgName: string;
  municipality: string | null;
  totalOre: number;
  stageSince: string;
  leadSource: string | null;
  potentialScore: number | null;
}

// Per-stage visual scaffold. Keyed by stage code so the API can add new
// stages without us having to renumber.
const STAGE_SCAFFOLD: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; headerBg: string }
> = {
  LEAD: { icon: Target, color: "border-t-brand-300", headerBg: "bg-brand-50" },
  DRAFT: { icon: Phone, color: "border-t-brand-400", headerBg: "bg-brand-50" },
  SENT: { icon: FileText, color: "border-t-brand-500", headerBg: "bg-brand-50" },
  ACCEPTED: {
    icon: CheckCircle2,
    color: "border-t-brand-600",
    headerBg: "bg-brand-50",
  },
  REJECTED: {
    icon: XCircle,
    color: "border-t-rose-400",
    headerBg: "bg-rose-50",
  },
};

function dealValue(deal: BoardDeal): string {
  return deal.totalOre > 0 ? formatKr(deal.totalOre) : "Ej offererad";
}

// ── Card ───────────────────────────────────────────────────────────
// Draggable via the native HTML5 drag API. That keeps the board free of a
// drag-and-drop dependency, and since dragging is a pointer gesture anyway
// the accessible path is the stage picker inside the deal dialog (opened by
// click or Enter), not a keyboard drag.
function DealCard({
  deal,
  dragging,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  deal: BoardDeal;
  dragging: boolean;
  draggable: boolean;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-deal-id={deal.id}
      data-deal-kind={deal.kind}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${deal.orgName}, ${STAGE_LABELS[deal.status] ?? deal.status}, ${dealValue(deal)}. Öppna detaljer.`}
      className={`group rounded-xl border border-border bg-card p-3 text-left text-card-foreground shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{deal.orgName}</p>
          {deal.municipality && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {deal.municipality}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{dealValue(deal)}</span>
            <Badge
              variant={
                daysSince(deal.stageSince) > 7 ? "destructive" : "secondary"
              }
              className="shrink-0 text-[10px]"
            >
              {daysSince(deal.stageSince)}d
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<BoardDeal[]>([]);
  const [stageTotals, setStageTotals] = useState<
    Record<string, { count: number; totalOre: number }>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  // Demo logins may read the board but not move deals — the server decides
  // and tells us, so we hide the gesture instead of failing it.
  const [readOnly, setReadOnly] = useState(false);

  // Drag state. `draggingId` drives the card's own dimmed look and
  // `dragOverStage` the drop target's highlight — both are presentation.
  // The drop *decision* reads `draggingRef`, which is written synchronously
  // in onDragStart: a state update wouldn't be committed yet if drop
  // arrives in the same tick, and then a legitimate move would be dropped
  // on the floor.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const draggingRef = useRef<BoardDeal | null>(null);
  // Some browsers fire a click right after a drop. Without this the deal
  // dialog would pop open every time a card is dragged.
  const dragEndedAt = useRef(0);

  const [detailRef, setDetailRef] = useState<PipelineDealRef | null>(null);
  const [quoteFor, setQuoteFor] = useState<{
    org: { id: string; name: string };
    sendNow: boolean;
  } | null>(null);

  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadSource, setLeadSource] = useState<string>("OUTBOUND");
  const [leadScore, setLeadScore] = useState("50");
  const [leadMunicipality, setLeadMunicipality] = useState("");
  const [leadWebsite, setLeadWebsite] = useState("");
  const [leadOrgNumber, setLeadOrgNumber] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "board") setView(stored);
  }, []);

  function changeView(next: "board" | "list") {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const loadPipeline = useCallback(async () => {
    try {
      const data = await portalFetch("/pipeline", {
        schema: pipelineResponseSchema,
      });
      setDeals(
        data.deals.map((d) => {
          const created =
            typeof d.createdAt === "string"
              ? d.createdAt
              : d.createdAt.toISOString();
          const since = d.stageSince
            ? typeof d.stageSince === "string"
              ? d.stageSince
              : d.stageSince.toISOString()
            : created;
          return {
            id: d.id,
            // `kind` is optional in the contract so an older API build
            // still validates; LEAD status implies the lead kind.
            kind: d.kind ?? (d.status === "LEAD" ? "LEAD" : "QUOTE"),
            status: d.status,
            orgId: d.orgId,
            orgName: d.orgName ?? "—",
            municipality: d.municipality ?? null,
            totalOre: d.totalOre,
            stageSince: since,
            leadSource: d.leadSource ?? null,
            potentialScore: d.potentialScore ?? null,
          };
        })
      );
      setStageTotals(
        Object.fromEntries(
          data.stages.map((s) => [
            s.stage,
            { count: s.count, totalOre: s.totalOre },
          ])
        )
      );
      setReadOnly(data.readOnly === true);
      setLoadError(null);
    } catch (err) {
      // The board previously soft-failed to an empty scaffold, which is
      // indistinguishable from "you have no deals". Say what happened.
      setLoadError(
        err instanceof Error ? err.message : "Kunde inte hämta pipeline."
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  const columns = useMemo(
    () =>
      ALL_STAGES.map((code) => ({
        code,
        label: STAGE_LABELS[code],
        ...STAGE_SCAFFOLD[code],
        deals: deals
          .filter((d) => d.status === code)
          .sort(
            (a, b) =>
              new Date(a.stageSince).getTime() -
              new Date(b.stageSince).getTime()
          ),
      })),
    [deals]
  );

  const sortedDeals = useMemo(
    () =>
      [...deals].sort((a, b) => {
        const byStage = stageIndex(a.status) - stageIndex(b.status);
        if (byStage !== 0) return byStage;
        return (
          new Date(a.stageSince).getTime() - new Date(b.stageSince).getTime()
        );
      }),
    [deals]
  );

  const totalValueOre = useMemo(
    () =>
      Object.values(stageTotals).reduce((sum, s) => sum + s.totalOre, 0),
    [stageTotals]
  );
  // The API caps the board at the 25 most recent leads + 25 quotes. When a
  // rep is over that, say so rather than showing counts that don't add up.
  const apiDealCount = useMemo(
    () => Object.values(stageTotals).reduce((sum, s) => sum + s.count, 0),
    [stageTotals]
  );
  const isTruncated = loaded && apiDealCount > deals.length;

  const draggedDeal = draggingId
    ? (deals.find((d) => d.id === draggingId) ?? null)
    : null;

  /** Optimistically move a quote, then reconcile with the server. */
  async function moveQuote(deal: BoardDeal, status: string) {
    const previous = deal.status;
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? { ...d, status, stageSince: new Date().toISOString() }
          : d
      )
    );
    try {
      const res = await portalFetch(`/quotes/${deal.id}/status`, {
        method: "PATCH",
        schema: updateQuoteStatusResponseSchema,
        body: { status },
      });
      toast(
        `${deal.orgName} flyttad till ${STAGE_LABELS[status] ?? status}.`,
        "success"
      );
      if (res.orgPromotedToCustomer) {
        toast(`${deal.orgName} är nu registrerad som kund.`, "success");
      }
      // Pull authoritative stage sums (they include deals beyond the cap).
      void loadPipeline();
    } catch (err) {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === deal.id ? { ...d, status: previous, stageSince: deal.stageSince } : d
        )
      );
      toast(
        err instanceof Error ? err.message : "Kunde inte flytta affären.",
        "error"
      );
    }
  }

  function handleDrop(targetStage: string, transferredId?: string) {
    const deal =
      draggingRef.current ??
      (transferredId ? deals.find((d) => d.id === transferredId) : undefined);
    draggingRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
    if (!deal) return;

    const intent = dropIntent(deal, targetStage);
    switch (intent.type) {
      case "noop":
        return;
      case "blocked":
        toast(intent.reason, "error");
        return;
      case "create-quote":
        setQuoteFor({
          org: { id: deal.orgId, name: deal.orgName },
          sendNow: intent.sendNow,
        });
        return;
      case "move-quote":
        void moveQuote(deal, intent.status);
        return;
    }
  }

  function openDeal(deal: BoardDeal) {
    if (Date.now() - dragEndedAt.current < 200) return;
    setDetailRef({ kind: deal.kind, id: deal.id });
  }

  async function handleCreateLead() {
    const name = leadName.trim();
    if (name.length < 2) {
      toast("Klubbnamn måste vara minst 2 tecken.", "error");
      return;
    }
    const score = Number.parseInt(leadScore, 10);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      toast("Potential måste vara 0–100.", "error");
      return;
    }
    setLeadSubmitting(true);
    try {
      const res = await apiFetch<{
        id?: string;
        name?: string;
        error?: string;
        existingOrgId?: string;
      }>("/v1/sales/leads", {
        method: "POST",
        body: {
          name,
          leadSource,
          potentialScore: score,
          municipality: leadMunicipality.trim() || undefined,
          website: leadWebsite.trim() || undefined,
          orgNumber: leadOrgNumber.trim() || undefined,
        },
      });
      if (res.ok && res.data?.id) {
        toast(`"${res.data.name}" är nu i Pipeline.`, "success");
        setLeadDialogOpen(false);
        setLeadName("");
        setLeadMunicipality("");
        setLeadWebsite("");
        setLeadOrgNumber("");
        void loadPipeline();
      } else {
        toast(res.data?.error || "Kunde inte skapa leadet.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setLeadSubmitting(false);
    }
  }

  /** Shared drop-zone handlers for a column. */
  function dropZoneProps(stage: string) {
    const intent = draggedDeal ? dropIntent(draggedDeal, stage) : null;
    const allowed =
      intent !== null && intent.type !== "blocked" && intent.type !== "noop";
    // Dragging a card back over the column it came from is a no-op, not a
    // rejected move, so it gets no ring at all — a red one would read as
    // "you may not put it back".
    const active =
      dragOverStage === stage &&
      draggedDeal !== null &&
      intent?.type !== "noop";
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!draggingRef.current) return;
        // Without preventDefault the browser refuses the drop entirely.
        e.preventDefault();
        e.dataTransfer.dropEffect = allowed ? "move" : "none";
        setDragOverStage(stage);
      },
      onDragLeave: (e: React.DragEvent) => {
        // dragleave also fires when the pointer crosses into a child, so
        // only clear when it truly left the column.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDragOverStage((current) => (current === stage ? null : current));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        handleDrop(stage, e.dataTransfer.getData("text/plain") || undefined);
      },
      allowed,
      className: active
        ? allowed
          ? "ring-2 ring-brand-400 ring-offset-2"
          : "ring-2 ring-destructive/50 ring-offset-2"
        : "",
    };
  }

  function cardDragProps(deal: BoardDeal) {
    return {
      draggable: !readOnly,
      dragging: draggingId === deal.id,
      onDragStart: (e: React.DragEvent) => {
        // Firefox requires payload data for a drag to start at all.
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        draggingRef.current = deal;
        setDraggingId(deal.id);
      },
      onDragEnd: () => {
        dragEndedAt.current = Date.now();
        draggingRef.current = null;
        setDraggingId(null);
        setDragOverStage(null);
      },
    };
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Totalt pipeline-värde:{" "}
            <span className="font-semibold text-foreground">
              {loaded ? formatKr(totalValueOre) : "—"}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readOnly ? (
              "Demokonto: du kan öppna affärerna, men inte ändra dem. Logga in med ditt eget säljarkonto för att flytta affärer och lägga till lead."
            ) : view === "board" ? (
              <>
                {/* Dragning finns bara på tavlan i lg+; i mobil-accordionen
                    byter man steg via detalj-popupen. */}
                <span className="hidden lg:inline">
                  Dra korten mellan stegen, eller klicka på ett kort för
                  detaljer.
                </span>
                <span className="lg:hidden">
                  Tryck på ett kort för detaljer och för att byta steg.
                </span>
              </>
            ) : (
              "Klicka på en rad för detaljer."
            )}
            {isTruncated && " Vyn visar de senaste affärerna per steg."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Vy-växlare */}
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Välj vy"
          >
            <button
              type="button"
              onClick={() => changeView("board")}
              aria-pressed={view === "board"}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "board"
                  ? "bg-brand-100 text-brand-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tavla
            </button>
            <button
              type="button"
              onClick={() => changeView("list")}
              aria-pressed={view === "list"}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-brand-100 text-brand-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
          </div>
          <Button
            onClick={() => setLeadDialogOpen(true)}
            disabled={readOnly}
            title={
              readOnly
                ? "Demokontot kan inte skapa lead — logga in med ditt säljarkonto."
                : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Nytt lead
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void loadPipeline()}>
            Försök igen
          </Button>
        </div>
      )}

      {view === "list" ? (
        <Card>
          <CardContent className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Förening</TableHead>
                  <TableHead>Steg</TableHead>
                  <TableHead>Värde</TableHead>
                  <TableHead>I steget</TableHead>
                  <TableHead className="text-right">Kommun</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDeal(deal)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDeal(deal);
                      }
                    }}
                    className="cursor-pointer outline-none focus-visible:bg-muted/60"
                  >
                    <TableCell className="font-medium">
                      {deal.orgName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stageBadgeVariant(deal.status)}>
                        {STAGE_LABELS[deal.status] ?? deal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {dealValue(deal)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {daysSince(deal.stageSince)} dagar
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {deal.municipality ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {loaded && sortedDeals.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Inga affärer ännu. Klicka på ”Nytt lead” för att lägga
                      till din första klubb.
                    </TableCell>
                  </TableRow>
                )}
                {!loaded && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Hämtar pipeline…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* MASTERPLAN_01 KC6.4 — desktop kanban (lg+).
              5 stages × ~250px deal-cards passar dåligt i mobile-viewport
              (320–414px); en 2-col-grid blir 2x3 raster med trunkerad
              text och ingen tydlig progression. Vi delar därför upp
              renderingen på en hård breakpoint. */}
          {/* Fem kolumner får plats från xl. Mellan lg och xl scrollar
              tavlan i sidled istället för att radbrytas — en kolumn som
              hamnar på rad två går inte att förstå som ett nästa steg. */}
          <div className="hidden overflow-x-auto pb-2 lg:block">
            <div className="grid min-w-[64rem] grid-cols-5 gap-4">
            {columns.map((col) => {
              const zone = dropZoneProps(col.code);
              return (
                <Card
                  key={col.code}
                  data-stage={col.code}
                  onDragOver={zone.onDragOver}
                  onDragLeave={zone.onDragLeave}
                  onDrop={zone.onDrop}
                  className={`border-t-4 transition-shadow ${col.color} ${zone.className}`}
                >
                  <CardContent className="p-4">
                    <div
                      className={`-mx-4 -mt-4 mb-4 flex items-center gap-2 rounded-t-lg px-4 py-3 ${col.headerBg}`}
                    >
                      <col.icon className="h-4 w-4 text-brand-400" />
                      <span className="text-sm font-semibold">{col.label}</span>
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold shadow-sm ring-1 ring-border">
                        {col.deals.length}
                      </span>
                    </div>
                    <div className="min-h-[4.5rem] space-y-3">
                      {col.deals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onOpen={() => openDeal(deal)}
                          {...cardDragProps(deal)}
                        />
                      ))}
                      {col.deals.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 text-center text-xs text-muted-foreground">
                          {!draggedDeal
                            ? "Inga affärer i detta steg"
                            : zone.allowed
                              ? "Släpp här"
                              : "Kan inte släppas här"}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>

          {/* MASTERPLAN_01 KC6.4 — mobile accordion (< lg).
              En stage per row, klick på header expanderar. Vi använder
              native <details>-elementet så hela funktionaliteten finns
              utan en JS-state-store — vilket också ger gratis a11y
              (keyboard, screen-reader announce). Dragning är avstängd
              här; på touch flyttar man affären via steg-väljaren i
              detalj-dialogen istället. */}
          <div className="space-y-3 lg:hidden" aria-label="Pipeline-stages">
            {columns.map((col, idx) => (
              <details
                key={col.code}
                open={idx < 2 || col.deals.length > 0}
                className={`group overflow-hidden rounded-xl border bg-card shadow-sm ${col.color} border-t-4`}
              >
                <summary
                  // P3.77 (audit 2026-05-26): saknade hover/focus-feedback.
                  // Lägg subtil bg-shift och focus-ring så användaren ser
                  // var de står (särskilt keyboard-användare).
                  className={`flex cursor-pointer list-none items-center gap-2 rounded-md px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring group-open:bg-transparent ${col.headerBg} [&::-webkit-details-marker]:hidden`}
                >
                  <col.icon className="h-4 w-4 text-brand-400" />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold shadow-sm ring-1 ring-border">
                    {col.deals.length}
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="space-y-3 p-4">
                  {col.deals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      draggable={false}
                      dragging={false}
                      onOpen={() => openDeal(deal)}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  ))}
                  {col.deals.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-6 text-center text-xs text-muted-foreground">
                      Inga affärer i detta steg
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}

      <PipelineDealDialog
        deal={detailRef}
        readOnly={readOnly}
        onClose={() => setDetailRef(null)}
        onStatusChanged={(dealId, status) => {
          setDeals((prev) =>
            prev.map((d) =>
              d.id === dealId
                ? { ...d, status, stageSince: new Date().toISOString() }
                : d
            )
          );
          void loadPipeline();
        }}
        onCreateQuote={(org) => {
          setDetailRef(null);
          setQuoteFor({ org, sendNow: false });
        }}
      />

      <NyOffertDialog
        open={quoteFor !== null}
        onOpenChange={(open) => !open && setQuoteFor(null)}
        presetOrg={quoteFor?.org ?? null}
        initialSendNow={quoteFor?.sendNow ?? false}
        onCreated={(quote) => {
          toast(
            `Offert på ${formatKr(quote.totalOre)} skapad för ${quote.orgName ?? "föreningen"}.`,
            "success"
          );
          setQuoteFor(null);
          // The lead card disappears from LEAD and reappears as a quote in
          // its new stage — the server derives that, so just refetch.
          void loadPipeline();
        }}
      />

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt lead</DialogTitle>
            <DialogDescription>
              Lägg till en klubb du har börjat bearbeta. Den hamnar under{" "}
              <strong>Lead</strong>-stadiet och tilldelas dig som ansvarig.
            </DialogDescription>
          </DialogHeader>

          {/* Scout fix 2026-05-26 (UX dialog-overflow): inputs satt
              tidigare i dialog-kanten utan padding. */}
          <div className="space-y-4 px-6 py-2">
            <div>
              <Label htmlFor="leadName">Klubbnamn</Label>
              <Input
                id="leadName"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="t.ex. Solna IF, IK Sirius"
                maxLength={255}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="leadSource">Källa</Label>
                <select
                  id="leadSource"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="leadScore">Potential (0–100)</Label>
                <Input
                  id="leadScore"
                  type="number"
                  min={0}
                  max={100}
                  value={leadScore}
                  onChange={(e) => setLeadScore(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="leadMunicipality">Kommun (valfritt)</Label>
                <Input
                  id="leadMunicipality"
                  value={leadMunicipality}
                  onChange={(e) => setLeadMunicipality(e.target.value)}
                  placeholder="t.ex. Stockholm"
                />
              </div>
              <div>
                <Label htmlFor="leadOrgNumber">Org.nr (valfritt)</Label>
                <Input
                  id="leadOrgNumber"
                  value={leadOrgNumber}
                  onChange={(e) => setLeadOrgNumber(e.target.value)}
                  placeholder="556677-8899"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="leadWebsite">Webbplats (valfritt)</Label>
              <Input
                id="leadWebsite"
                value={leadWebsite}
                onChange={(e) => setLeadWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeadDialogOpen(false)}
              disabled={leadSubmitting}
            >
              Avbryt
            </Button>
            <Button onClick={handleCreateLead} disabled={leadSubmitting}>
              {leadSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Skapa lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
