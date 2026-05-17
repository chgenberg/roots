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

function statusVariant(status: string) {
  if (status === "Aktiv") return "success" as const;
  if (status === "Ny") return "warning" as const;
  return "secondary" as const;
}

export default function KlubbarPage() {
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API shape: { clubs: [organization-row] }. The org row only includes
    // identity columns (id, name, type, orgNumber, createdAt); members
    // count, last-order date and revenue are not joined yet — until that
    // backend is built we show "—" for those columns instead of fabricated
    // numbers.
    portalFetch("/clubs", { schema: clubsListResponseSchema })
      .then((data) => {
        setClubs(
          (data.clubs ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            members: null,
            status: c.type === "club" ? "Aktiv" : "Ny",
            lastOrder: "—",
            revenue: "—",
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {clubs.length === 0
                      ? "Inga klubbar registrerade ännu. Listan fylls på när er första förening kopplas till ert säljterritorium."
                      : "Inga klubbar matchade sökningen."}
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Hämtar klubbar…
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
