"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Target, Phone, FileText, CheckCircle2 } from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import { pipelineResponseSchema } from "@roots/contracts";

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

const FALLBACK_COLUMNS: {
  stage: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  headerBg: string;
  deals: Deal[];
}[] = [
  {
    stage: "Lead",
    icon: Target,
    color: "border-t-brand-300",
    headerBg: "bg-brand-50",
    deals: [
      { id: 1, club: "Brynäs IF", contact: "Per Olsson", value: "8 500 kr", daysInStage: 2 },
      { id: 2, club: "Luleå HF", contact: "Karin Ström", value: "6 000 kr", daysInStage: 5 },
      { id: 3, club: "IFK Norrköping", contact: "Mats Ek", value: "7 200 kr", daysInStage: 1 },
    ],
  },
  {
    stage: "Kontaktad",
    icon: Phone,
    color: "border-t-brand-400",
    headerBg: "bg-brand-50",
    deals: [
      { id: 4, club: "GAIS", contact: "Lisa Blom", value: "5 400 kr", daysInStage: 3 },
      { id: 5, club: "Malmö FF Basket", contact: "Jonas Ryd", value: "9 100 kr", daysInStage: 7 },
    ],
  },
  {
    stage: "Offert skickad",
    icon: FileText,
    color: "border-t-brand-500",
    headerBg: "bg-brand-50",
    deals: [
      { id: 6, club: "AIK Simning", contact: "Sara Björk", value: "4 900 kr", daysInStage: 4 },
      { id: 7, club: "Hammarby HK", contact: "Erik Ljung", value: "12 000 kr", daysInStage: 10 },
    ],
  },
  {
    stage: "Avslutad",
    icon: CheckCircle2,
    color: "border-t-brand-600",
    headerBg: "bg-brand-50",
    deals: [
      { id: 8, club: "Djurgårdens IF", contact: "Anna K.", value: "8 400 kr", daysInStage: 0 },
    ],
  },
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
  const [columns, setColumns] = useState(FALLBACK_COLUMNS);
  const [totalValueOre, setTotalValueOre] = useState<number | null>(null);

  useEffect(() => {
    // API shape (see packages/contracts/src/portal.ts):
    //   { stages: [{ stage, count, totalOre }], deals: [{ id, status, totalOre, orgId, createdAt }] }
    // Each stage's `deals` list is derived client-side by filtering `deals`
    // on status — previously the UI tried `s.deals` which the API never
    // produced, so the pipeline page always showed empty columns.
    portalFetch("/pipeline", { schema: pipelineResponseSchema })
      .then((data) => {
        if (!data.stages?.length) return;
        setColumns(
          data.stages.map((s, i) => {
            const fb = FALLBACK_COLUMNS[i] || FALLBACK_COLUMNS[0];
            const stageDeals = data.deals
              .filter((d) => d.status === s.stage)
              .map((d) => ({
                id: d.id,
                club: `Klubb ${d.orgId.slice(0, 6)}`,
                contact: "",
                value: formatSek(d.totalOre),
                daysInStage: daysBetween(
                  typeof d.createdAt === "string"
                    ? d.createdAt
                    : d.createdAt.toISOString()
                ),
              }));
            return {
              stage: STAGE_LABELS[s.stage] ?? fb.stage,
              icon: fb.icon,
              color: fb.color,
              headerBg: fb.headerBg,
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
    totalValueOre !== null ? formatSek(totalValueOre) : "45 000 kr";

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Totalt pipeline-värde: <span className="font-semibold text-foreground">{totalValue}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {columns.map((col) => (
            <Badge key={col.stage} variant="outline" className="text-xs">
              {col.stage}: {col.deals.length}
            </Badge>
          ))}
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
    </div>
  );
}
