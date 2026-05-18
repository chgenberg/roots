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
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Target,
  Phone,
  FileText,
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import { pipelineResponseSchema } from "@roots/contracts";

const LEAD_SOURCES = [
  { value: "INBOUND", label: "Inkommande (förfrågan)" },
  { value: "OUTBOUND", label: "Utgående (kallt samtal)" },
  { value: "EVENT", label: "Mässa / event" },
  { value: "REFERRAL", label: "Rekommendation" },
  { value: "WEB", label: "Webbplats" },
  { value: "MANUAL", label: "Manuellt skapad" },
] as const;

interface Deal {
  id: string | number;
  club: string;
  contact: string;
  value: string;
  daysInStage: number;
}

// API uses the SQL enum DRAFT/SENT/ACCEPTED/REJECTED; the UI shows Swedish
// labels. This mapping is the single source of truth in this file.
const STAGE_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  SENT: "Skickad",
  ACCEPTED: "Accepterad",
  REJECTED: "Nekad",
};

function formatSek(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

function daysBetween(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

interface PipelineColumn {
  stage: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  headerBg: string;
  deals: Deal[];
}

// Visual scaffolding only — no fake deals. The columns themselves are always
// rendered (so the stage hierarchy is visible) and populate from /pipeline.
const EMPTY_COLUMNS: PipelineColumn[] = [
  { stage: "Lead", icon: Target, color: "border-t-brand-300", headerBg: "bg-brand-50", deals: [] },
  { stage: "Kontaktad", icon: Phone, color: "border-t-brand-400", headerBg: "bg-brand-50", deals: [] },
  { stage: "Offert skickad", icon: FileText, color: "border-t-brand-500", headerBg: "bg-brand-50", deals: [] },
  { stage: "Avslutad", icon: CheckCircle2, color: "border-t-brand-600", headerBg: "bg-brand-50", deals: [] },
];

function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="cursor-grab rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-semibold">{deal.club}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{deal.contact}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold">{deal.value}</span>
        <Badge
          variant={deal.daysInStage > 7 ? "destructive" : "secondary"}
          className="text-[10px]"
        >
          {deal.daysInStage}d
        </Badge>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [columns, setColumns] = useState<PipelineColumn[]>(EMPTY_COLUMNS);
  const [totalValueOre, setTotalValueOre] = useState<number | null>(null);

  // Sprint E9: "Nytt lead" modal. The form is intentionally minimal —
  // every additional field is one more reason a busy sales rep won't
  // use it. We only require the org name. Everything else is optional
  // and can be filled in later when the lead progresses.
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadSource, setLeadSource] = useState<string>("OUTBOUND");
  const [leadScore, setLeadScore] = useState("50");
  const [leadMunicipality, setLeadMunicipality] = useState("");
  const [leadWebsite, setLeadWebsite] = useState("");
  const [leadOrgNumber, setLeadOrgNumber] = useState("");
  const { toast } = useToast();

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
        // The pipeline endpoint only surfaces deals that have quotes,
        // so a fresh lead won't appear in the kanban yet. We just rely
        // on the toast confirmation. /portal/klubbar will show the row.
      } else {
        toast(res.data?.error || "Kunde inte skapa leadet.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setLeadSubmitting(false);
    }
  }

  useEffect(() => {
    // API shape (see packages/contracts/src/portal.ts):
    //   { stages: [{ stage, count, totalOre }], deals: [{ id, status, totalOre, orgId, createdAt }] }
    // Stage scaffolding is fixed (EMPTY_COLUMNS); we only swap in real deals
    // when the API returns them.
    portalFetch("/pipeline", { schema: pipelineResponseSchema })
      .then((data) => {
        if (!data.stages?.length) {
          setTotalValueOre(0);
          return;
        }
        setColumns(
          data.stages.map((s, i) => {
            const scaffold = EMPTY_COLUMNS[i] ?? EMPTY_COLUMNS[0];
            const stageDeals = data.deals
              .filter((d) => d.status === s.stage)
              .map((d) => ({
                id: d.id,
                // Use the joined org name from /v1/portal/pipeline. Fall
                // back to "—" rather than the old "Klubb <orgId-prefix>"
                // placeholder, which made every kanban card look like
                // synthetic data.
                club: d.orgName ?? "—",
                contact: "",
                value: formatSek(d.totalOre),
                daysInStage: daysBetween(
                  typeof d.createdAt === "string"
                    ? d.createdAt
                    : d.createdAt.toISOString()
                ),
              }));
            return {
              stage: STAGE_LABELS[s.stage] ?? scaffold.stage,
              icon: scaffold.icon,
              color: scaffold.color,
              headerBg: scaffold.headerBg,
              deals: stageDeals,
            };
          })
        );
        setTotalValueOre(
          data.stages.reduce((sum, s) => sum + s.totalOre, 0)
        );
      })
      .catch(() => {});
  }, []);

  const totalValue =
    totalValueOre !== null ? formatSek(totalValueOre) : "—";

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Totalt pipeline-värde: <span className="font-semibold text-foreground">{totalValue}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {columns.map((col) => (
              <Badge key={col.stage} variant="outline" className="text-xs">
                {col.stage}: {col.deals.length}
              </Badge>
            ))}
          </div>
          <Button onClick={() => setLeadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nytt lead
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => (
          <Card
            key={col.stage}
            className={`border-t-4 ${col.color}`}
          >
            <CardContent className="p-4">
              <div className={`-mx-4 -mt-4 mb-4 flex items-center gap-2 rounded-t-lg px-4 py-3 ${col.headerBg}`}>
                <col.icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm font-semibold">{col.stage}</span>
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold shadow-sm ring-1 ring-border">
                  {col.deals.length}
                </span>
              </div>
              <div className="min-h-[4.5rem] space-y-3">
                {col.deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                {col.deals.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 text-center text-xs text-muted-foreground">
                    Inga affärer i detta steg
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt lead</DialogTitle>
            <DialogDescription>
              Lägg till en klubb du har börjat bearbeta. Den hamnar under{" "}
              <strong>Lead</strong>-stadiet och tilldelas dig som ansvarig.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
