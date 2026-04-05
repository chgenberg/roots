import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Kunder" };

export default function KunderPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Kunder</h1>
      <p className="mt-1 text-muted-foreground">
        Anslutna föreningar och deras kontaktuppgifter.
      </p>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Förening</TableHead>
              <TableHead>Org.nummer</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>E-post</TableHead>
              <TableHead className="text-right">Ordrar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <span>Inga klubbar anslutna ännu.</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
