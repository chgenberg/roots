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
  revenueOre: number;
}

function statusVariant(status: string) {
  if (status === "Kund") return "success" as const;
  if (status === "Lead") return "warning" as const;
  return "secondary" as const;
}

function formatSek(ore: number): string {
  if (!ore || ore <= 0) return "—";
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sv-SE");
}

function crmStatusLabel(crm: string | null | undefined, type: string | null | undefined): string {
  // crmStatus is authoritative when present; type only used as fallback so
  // the column never shows a raw enum value like "PROSPECT".
  if (crm === "CUSTOMER") return "Kund";
  if (crm === "LEAD") return "Lead";
  if (crm === "PROSPECT") return "Prospect";
  if (crm === "INACTIVE") return "Inaktiv";
  if (type === "club") return "Kund";
  return "Lead";
}

export default function KlubbarPage() {
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/clubs", { schema: clubsListResponseSchema })
      .then((data) => {
        setClubs(
          (data.clubs ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            members: c.membersCount ?? 0,
            status: crmStatusLabel(c.crmStatus, c.type),
            lastOrder: formatDate(
              typeof c.lastOrderAt === "string"
                ? c.lastOrderAt
                : c.lastOrderAt instanceof Date
                  ? c.lastOrderAt.toISOString()
                  : null
            ),
            revenueOre: c.revenueOre ?? 0,
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
                <p className="text-2xl font-bold">{clubs.filter((c) => c.status === "Kund").length}</p>
                <p className="text-xs text-muted-foreground">Aktiva kunder</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{clubs.filter((c) => c.status === "Lead").length}</p>
                <p className="text-xs text-muted-foreground">Nya leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {formatSek(clubs.reduce((sum, c) => sum + c.revenueOre, 0))}
                </p>
                <p className="text-xs text-muted-foreground">Total intäkt</p>
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
                  <TableCell className="text-right font-medium">{formatSek(c.revenueOre)}</TableCell>
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
