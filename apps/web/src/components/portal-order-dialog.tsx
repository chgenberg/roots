"use client";

/**
 * Portal (B2B) order / invoice detail dialog.
 *
 * Used by /portal/bestallningar and /portal/fakturor — both list the
 * same `orders` table, just with different framings (delivery status
 * vs Fortnox invoice status). One dialog, two entry points.
 *
 * Backed by `GET /v1/portal/orders/:orderId` which is RBAC-locked
 * to portal roles (CLUB_ADMIN/CLUB_MEMBER/SALES_REP/SALES_ADMIN/
 * INTERNAL_ADMIN). Fundraising roles get 403.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Mail,
  Building2,
  Package,
  FileText,
  ExternalLink,
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

export interface PortalOrderDetail {
  order: {
    id: string;
    status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
    invoiceStatus: "NONE" | "PENDING" | "ISSUED" | "PAID" | "CANCELLED";
    fortnoxInvoiceId: string | null;
    totalOre: number;
    idempotencyKey: string | null;
    quoteId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organization: { id: string; name: string } | null;
  buyer: { id: string; name: string; email: string } | null;
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string | null;
    qty: number;
    unitPriceOre: number;
    lineTotalOre: number;
  }>;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-success/15 text-success border-success/40",
  SHIPPED: "bg-success/15 text-success border-success/40",
  DELIVERED: "bg-success/15 text-success border-success/40",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Väntar",
  CONFIRMED: "Bekräftad",
  SHIPPED: "Skickad",
  DELIVERED: "Levererad",
  CANCELLED: "Avbruten",
};
const INVOICE_STATUS_COLORS: Record<string, string> = {
  NONE: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ISSUED: "bg-blue-100 text-blue-800 border-blue-300",
  PAID: "bg-success/15 text-success border-success/40",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  NONE: "Ingen faktura",
  PENDING: "Förbereds",
  ISSUED: "Skickad",
  PAID: "Betald",
  CANCELLED: "Makulerad",
};

function formatSek(ore: number): string {
  return `${(ore / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kr`;
}
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function PortalOrderDialog({ open, onOpenChange, orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PortalOrderDetail | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/v1/portal/orders/${orderId}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!cancelled) {
            setError(j?.error ?? "Kunde inte hämta order.");
          }
          return;
        }
        const json = (await res.json()) as PortalOrderDetail;
        if (!cancelled) setDetail(json);
      } catch {
        if (!cancelled) setError("Nätverksfel. Försök igen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const subtotalOre = detail
    ? detail.lines.reduce((sum, l) => sum + l.lineTotalOre, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orderdetaljer</DialogTitle>
          <DialogDescription>
            {detail
              ? `Order #${detail.order.id.slice(0, 8)} · ${formatDateTime(detail.order.createdAt)}`
              : "Hämtar information…"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">
              {error}
            </p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wide ${
                    ORDER_STATUS_COLORS[detail.order.status] ?? ""
                  }`}
                >
                  {ORDER_STATUS_LABELS[detail.order.status] ??
                    detail.order.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wide ${
                    INVOICE_STATUS_COLORS[detail.order.invoiceStatus] ?? ""
                  }`}
                >
                  Faktura:{" "}
                  {INVOICE_STATUS_LABELS[detail.order.invoiceStatus] ??
                    detail.order.invoiceStatus}
                </Badge>
                {detail.order.fortnoxInvoiceId && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px]"
                    title="Fortnox-faktura-ID"
                  >
                    Fortnox #{detail.order.fortnoxInvoiceId}
                  </Badge>
                )}
                {detail.order.quoteId && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px]"
                    title="Offert-ID"
                  >
                    Offert {detail.order.quoteId.slice(0, 8)}
                  </Badge>
                )}
              </div>

              {(detail.organization || detail.buyer) && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Köpare
                  </h3>
                  <div className="rounded-lg border bg-brand-50/40 p-4 text-sm">
                    {detail.organization && (
                      <p className="flex items-center gap-2 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {detail.organization.name}
                      </p>
                    )}
                    {detail.buyer && (
                      <>
                        <p className="mt-1 text-muted-foreground">
                          {detail.buyer.name}
                        </p>
                        {detail.buyer.email && (
                          <p className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <a
                              href={`mailto:${detail.buyer.email}`}
                              className="hover:underline"
                            >
                              {detail.buyer.email}
                            </a>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Produkter
                </h3>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Produkt
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Antal
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          á-pris
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Summa
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-xs text-muted-foreground"
                          >
                            Inga rader registrerade på denna order.
                          </td>
                        </tr>
                      ) : (
                        detail.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2">
                              <div className="flex items-start gap-2">
                                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {l.productName}
                                  </p>
                                  {l.productSku && (
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                      {l.productSku}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.qty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatSek(l.unitPriceOre)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatSek(l.lineTotalOre)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delsumma</span>
                    <span className="tabular-nums">
                      {formatSek(subtotalOre)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Totalt</span>
                    <span className="tabular-nums">
                      {formatSek(detail.order.totalOre)}
                    </span>
                  </div>
                </div>
              </section>

              {detail.order.fortnoxInvoiceId && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bokföring
                  </h3>
                  <div className="flex items-start gap-2 rounded-lg border bg-brand-50/40 p-4 text-sm">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p>
                        Fakturan är synkad till Fortnox med ID{" "}
                        <span className="font-mono">
                          {detail.order.fortnoxInvoiceId}
                        </span>
                        .
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Status och betalning hanteras direkt i Fortnox.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <p className="text-xs text-muted-foreground">
                Skapad {formatDateTime(detail.order.createdAt)}
                {detail.order.updatedAt !== detail.order.createdAt && (
                  <>
                    {" · "}senast uppdaterad{" "}
                    {formatDateTime(detail.order.updatedAt)}
                  </>
                )}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export icon used by callers to keep import surface tight.
export { ExternalLink };
