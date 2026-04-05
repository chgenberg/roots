import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const metadata: Metadata = { title: "Orderhistorik" };

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  PENDING: { label: "Väntar", variant: "warning" },
  CONFIRMED: { label: "Bekräftad", variant: "secondary" },
  SHIPPED: { label: "Skickad", variant: "default" },
  DELIVERED: { label: "Levererad", variant: "success" },
  CANCELLED: { label: "Avbruten", variant: "destructive" },
};

interface Order {
  id: string;
  date: string;
  status: string;
  items: string;
  total: string;
}

const DEMO_ORDERS: Order[] = [];

export default function HistorikPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Orderhistorik</h1>
      <p className="mt-1 text-muted-foreground">
        Alla beställningar från din förening.
      </p>

      {DEMO_ORDERS.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">Inga ordrar ännu.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Innehåll</TableHead>
                <TableHead className="text-right">Summa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_ORDERS.map((order) => {
                const status = STATUS_MAP[order.status] || { label: order.status, variant: "secondary" as const };
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{order.items}</TableCell>
                    <TableCell className="text-right font-medium">{order.total}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
