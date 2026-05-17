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

const FALLBACK_QUOTES = [
  {
    id: "OFF-001",
    client: "Brynäs IF",
    contact: "Per Olsson",
    amount: "8 500 kr",
    status: "Skickad",
    date: "2025-03-28",
    validUntil: "2025-04-28",
  },
  {
    id: "OFF-002",
    client: "GAIS",
    contact: "Lisa Blom",
    amount: "5 400 kr",
    status: "Utkast",
    date: "2025-03-27",
    validUntil: "—",
  },
  {
    id: "OFF-003",
    client: "Malmö FF Basket",
    contact: "Jonas Ryd",
    amount: "9 100 kr",
    status: "Skickad",
    date: "2025-03-20",
    validUntil: "2025-04-20",
  },
  {
    id: "OFF-004",
    client: "AIK Simning",
    contact: "Sara Björk",
    amount: "4 900 kr",
    status: "Accepterad",
    date: "2025-03-15",
    validUntil: "2025-04-15",
  },
  {
    id: "OFF-005",
    client: "Luleå HF",
    contact: "Karin Ström",
    amount: "6 000 kr",
    status: "Nekad",
    date: "2025-03-10",
    validUntil: "2025-04-10",
  },
  {
    id: "OFF-006",
    client: "Hammarby HK",
    contact: "Erik Ljung",
    amount: "12 000 kr",
    status: "Skickad",
    date: "2025-03-05",
    validUntil: "2025-04-05",
  },
];

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
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);

  useEffect(() => {
    // API shape: { quotes: [{ id, orgId, salesRepId, status, totalOre, validUntil, createdAt }] }
    // Previously the UI read `client/contact/amount` (and a Swedish-string
    // status) — none of which the API ever produced. We now map each row
    // through the contract schema and format it into the table's display
    // shape.
    portalFetch("/quotes", { schema: quotesListResponseSchema })
      .then((data) => {
        if (!data.quotes?.length) return;
        setQuotes(
          data.quotes.map((q) => ({
            id: q.id.slice(0, 8).toUpperCase(),
            client: `Klubb ${q.orgId.slice(0, 6)}`,
            contact: "",
            amount: formatSek(q.totalOre),
            status: QUOTE_STATUS_LABELS[q.status] ?? q.status,
            date: formatDate(q.createdAt),
            validUntil: formatDate(q.validUntil ?? null),
          }))
        );
      })
      .catch(() => {});
  }, []);

  const totalSent = quotes.filter((q) => q.status === "Skickad").length;
  const totalAccepted = quotes.filter((q) => q.status === "Accepterad").length;
  const totalValue = "45 900 kr";

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
                  <TableCell className="text-muted-foreground">{q.contact}</TableCell>
                  <TableCell className="font-medium">{q.amount}</TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{q.date}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{q.validUntil}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
