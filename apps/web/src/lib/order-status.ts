/**
 * Etiketter och färger för kundorderstatus.
 *
 * En order rör sig PENDING → PAID → CONFIRMED → SHIPPED → DELIVERED, och alla
 * fyra sista räknas som intäkt (se REVENUE_ORDER_STATUSES i @roots/contracts).
 * Vyerna hade tidigare varsin delmängd av statusarna, så en levererad order
 * visades som rå "DELIVERED" i vissa listor. Håll den här kartan komplett mot
 * customerOrderStatusEnum i packages/db.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  PENDING: "Väntar på betalning",
  PAID: "Betald",
  CONFIRMED: "Bekräftad",
  SHIPPED: "Skickad",
  DELIVERED: "Levererad",
  CANCELLED: "Avbruten",
  REFUNDED: "Återbetald",
  FAILED: "Misslyckad",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-warning-surface text-warning-strong border-warning-edge",
  PAID: "bg-success/15 text-success border-success/40",
  CONFIRMED: "bg-success/15 text-success border-success/40",
  SHIPPED: "bg-brand-100 text-brand-900 border-brand-300",
  DELIVERED: "bg-success/15 text-success border-success/40",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
  REFUNDED: "bg-destructive/10 text-destructive border-destructive/30",
  FAILED: "bg-destructive/10 text-destructive border-destructive/30",
};

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderStatusColor(status: string | null | undefined): string {
  if (!status) return ORDER_STATUS_COLORS.DRAFT;
  return ORDER_STATUS_COLORS[status] ?? ORDER_STATUS_COLORS.DRAFT;
}
