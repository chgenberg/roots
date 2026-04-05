import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const metadata: Metadata = { title: "Ordrar" };

export default function OrdrarPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Ordrar</h1>
      <p className="mt-1 text-muted-foreground">
        Alla ordrar från klubbar. Filtrera, uppdatera status och följ leveranser.
      </p>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order-ID</TableHead>
              <TableHead>Klubb</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Summa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                Inga ordrar ännu.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
