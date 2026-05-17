"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FileText, Plus, Send, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { portalFetch } from "@/lib/portal-api";
import { quotesListResponseSchema } from "@roots/contracts";

// API status enum (DRAFT/SENT/ACCEPTED/REJECTED) → Swedish UI label.
const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  SENT: "Skickad",
  ACCEPTED: "Accepterad",
  REJECTED: "Nekad",
};

function formatSek(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

interface QuoteRow {
  id: string;
  client: string;
  contact: string;
  totalOre: number;
  status: string;
  date: string;
  validUntil: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "Accepterad":
      return <Badge variant="success">{status}</Badge>;
    case "Skickad":
      return <Badge variant="secondary" className="bg-brand-50 text-brand-600">{status}</Badge>;
    case "Utkast":
      return <Badge variant="outline">{status}</Badge>;
    case "Nekad":
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Accepterad": return <CheckCircle2 className="h-4 w-4 text-brand-400" />;
    case "Skickad": return <Send className="h-4 w-4 text-brand-400" />;
    case "Utkast": return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "Nekad": return <XCircle className="h-4 w-4 text-red-500" />;
    default: return null;
  }
}

export default function OfferterPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API shape: { quotes: [{ id, orgId, salesRepId, status, totalOre, validUntil, createdAt }] }
    portalFetch("/quotes", { schema: quotesListResponseSchema })
      .then((data) => {
        setQuotes(
          (data.quotes ?? []).map((q) => ({
            id: q.id.slice(0, 8).toUpperCase(),
            client: `Klubb ${q.orgId.slice(0, 6)}`,
            contact: "",
            totalOre: q.totalOre,
            status: QUOTE_STATUS_LABELS[q.status] ?? q.status,
            date: formatDate(q.createdAt),
            validUntil: formatDate(q.validUntil ?? null),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSent = quotes.filter((q) => q.status === "Skickad").length;
  const totalAccepted = quotes.filter((q) => q.status === "Accepterad").length;
  // Pipeline-value: sum of every "open" offer (Utkast + Skickad). Accepterade
  // räknas inte längre eftersom de då övergår till order.
  const openTotalOre = quotes
    .filter((q) => q.status === "Utkast" || q.status === "Skickad")
    .reduce((sum, q) => sum + q.totalOre, 0);
  const totalValue = formatSek(openTotalOre);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offerter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skapa och hantera offerter till föreningar.
          </p>
        </div>
        <Button onClick={() => toast("Offertfunktion kommer snart!")}>
          <Plus className="h-4 w-4" />
          Ny offert
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Skickade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalAccepted}</p>
                <p className="text-xs text-muted-foreground">Accepterade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalValue}</p>
                <p className="text-xs text-muted-foreground">Totalvärde</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offert-ID</TableHead>
                <TableHead>Kund</TableHead>
                <TableHead>Kontaktperson</TableHead>
                <TableHead>Belopp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Giltig t.o.m.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.id}</TableCell>
                  <TableCell className="font-medium">{q.client}</TableCell>
                  <TableCell className="text-muted-foreground">{q.contact || "—"}</TableCell>
                  <TableCell className="font-medium">{formatSek(q.totalOre)}</TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{q.date}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{q.validUntil}</TableCell>
                </TableRow>
              ))}
              {!loading && quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Inga offerter ännu. Klicka på "Ny offert" för att skapa den första.
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Hämtar offerter…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
