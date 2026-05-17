"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import { clubsListResponseSchema } from "@roots/contracts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Building2, Search } from "lucide-react";

interface ClubRow {
  id: string | number;
  name: string;
  members: number | null;
  status: string;
  lastOrder: string;
  revenue: string;
}

const FALLBACK_CLUBS: ClubRow[] = [
  { id: 1, name: "Hammarby HK", members: 42, status: "Aktiv", lastOrder: "2025-03-28", revenue: "8 400 kr" },
  { id: 2, name: "Djurgårdens IF Basket", members: 35, status: "Aktiv", lastOrder: "2025-03-25", revenue: "6 200 kr" },
  { id: 3, name: "AIK Simning", members: 28, status: "Aktiv", lastOrder: "2025-03-20", revenue: "4 900 kr" },
  { id: 4, name: "GAIS", members: 19, status: "Ny", lastOrder: "—", revenue: "0 kr" },
  { id: 5, name: "Brynäs IF", members: 31, status: "Aktiv", lastOrder: "2025-03-15", revenue: "3 600 kr" },
  { id: 6, name: "Malmö FF Basket", members: 22, status: "Pausad", lastOrder: "2025-01-12", revenue: "1 800 kr" },
  { id: 7, name: "IFK Norrköping", members: 15, status: "Ny", lastOrder: "—", revenue: "0 kr" },
  { id: 8, name: "Luleå HF", members: 38, status: "Aktiv", lastOrder: "2025-03-22", revenue: "5 100 kr" },
];

function statusVariant(status: string) {
  if (status === "Aktiv") return "success" as const;
  if (status === "Ny") return "warning" as const;
  return "secondary" as const;
}

export default function KlubbarPage() {
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<ClubRow[]>(FALLBACK_CLUBS);

  useEffect(() => {
    // API shape: { clubs: [organization-row] }. The org row only includes
    // identity columns (id, name, type, orgNumber, createdAt); members
    // count, last-order date and revenue are not joined yet. Until that
    // backend is built we display "—" instead of the previous fabricated
    // numbers that came from `c.members/c.lastOrder/c.revenue` (none of
    // which the API ever produced).
    portalFetch("/clubs", { schema: clubsListResponseSchema })
      .then((data) => {
        if (!data.clubs?.length) return;
        setClubs(
          data.clubs.map((c) => ({
            id: c.id,
            name: c.name,
            members: null,
            status: c.type === "club" ? "Aktiv" : "Ny",
            lastOrder: "—",
            revenue: "—",
          }))
        );
      })
      .catch(() => {});
  }, []);

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Klubbar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alla föreningar i ditt säljterritorium.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{clubs.length}</p>
                <p className="text-xs text-muted-foreground">Totala klubbar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{clubs.filter((c) => c.status === "Aktiv").length}</p>
                <p className="text-xs text-muted-foreground">Aktiva</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{clubs.filter((c) => c.status === "Ny").length}</p>
                <p className="text-xs text-muted-foreground">Nya leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök klubb..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klubb</TableHead>
                <TableHead>Medlemmar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Senaste order</TableHead>
                <TableHead className="text-right">Intäkter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.members ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.lastOrder}</TableCell>
                  <TableCell className="text-right font-medium">{c.revenue}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Inga klubbar hittades.
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
