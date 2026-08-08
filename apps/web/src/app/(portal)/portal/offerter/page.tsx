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
import { FileText, Plus, Send, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { portalFetch } from "@/lib/portal-api";
import { LoadError } from "@/components/load-error";
import { quotesListResponseSchema } from "@roots/contracts";
import { formatKr } from "@/lib/format";
import { NyOffertDialog } from "@/components/ny-offert-dialog";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";

type QuoteStatus = keyof (typeof portalShared)["sv"]["quoteStatus"];

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

interface QuoteRow {
  id: string;
  shortId: string;
  client: string;
  contact: string;
  totalOre: number;
  status: QuoteStatus;
  date: string;
  validUntil: string;
}

function statusBadge(
  status: QuoteStatus,
  label: string
) {
  switch (status) {
    case "ACCEPTED":
      return <Badge variant="success">{label}</Badge>;
    case "SENT":
      return (
        <Badge variant="secondary" className="bg-brand-50 text-brand-600">
          {label}
        </Badge>
      );
    case "DRAFT":
      return <Badge variant="outline">{label}</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">{label}</Badge>;
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

export default function OfferterPage() {
  const { locale } = useLocale();
  const t = portalPages.offerter[locale];
  const shared = portalShared[locale];
  const quoteLabels = shared.quoteStatus;

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    portalFetch("/quotes", { schema: quotesListResponseSchema })
      .then((data) => {
        setQuotes(
          (data.quotes ?? []).map((q) => ({
            id: q.id,
            shortId: q.id.slice(0, 8).toUpperCase(),
            client: q.orgName ?? "—",
            contact: "",
            totalOre: q.totalOre,
            status: q.status as QuoteStatus,
            date: formatDate(q.createdAt),
            validUntil: formatDate(q.validUntil ?? null),
          }))
        );
      })
      .catch(() => {
        setError(t.loadError);
      })
      .finally(() => setLoading(false));
  }, [t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSent = quotes.filter((q) => q.status === "SENT").length;
  const totalAccepted = quotes.filter((q) => q.status === "ACCEPTED").length;
  const openTotalOre = quotes
    .filter((q) => q.status === "DRAFT" || q.status === "SENT")
    .reduce((sum, q) => sum + q.totalOre, 0);
  const totalValue = formatKr(openTotalOre, locale);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t.newQuote}
        </Button>
      </div>

      {error && <LoadError message={error} onRetry={load} inline />}

      <NyOffertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(q) =>
          setQuotes((prev) => [
            {
              id: q.id,
              shortId: q.id.slice(0, 8).toUpperCase(),
              client: q.orgName ?? "—",
              contact: "",
              totalOre: q.totalOre,
              status: q.status as QuoteStatus,
              date: formatDate(q.createdAt),
              validUntil: formatDate(q.validUntil ?? null),
            },
            ...prev,
          ])
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">{t.sent}</p>
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
                <p className="text-xs text-muted-foreground">{t.accepted}</p>
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
                <p className="text-xs text-muted-foreground">{t.totalValue}</p>
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
                <TableHead>{t.colId}</TableHead>
                <TableHead>{t.colClient}</TableHead>
                <TableHead>{t.colContact}</TableHead>
                <TableHead>{t.colAmount}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead>{t.colDate}</TableHead>
                <TableHead className="text-right">{t.colValidUntil}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.shortId}</TableCell>
                  <TableCell className="font-medium">{q.client}</TableCell>
                  <TableCell className="text-muted-foreground">{q.contact || "—"}</TableCell>
                  <TableCell className="font-medium">
                    {formatKr(q.totalOre, locale)}
                  </TableCell>
                  <TableCell>
                    {statusBadge(q.status, quoteLabels[q.status])}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{q.date}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{q.validUntil}</TableCell>
                </TableRow>
              ))}
              {!loading && quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t.empty}
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t.loading}
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
