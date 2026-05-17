"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import { membersListResponseSchema } from "@roots/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Users, UserPlus, Search, Mail } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface MemberRow {
  id: string | number;
  name: string;
  email: string;
  status: string;
  joined: string;
}

const FALLBACK_MEMBERS: MemberRow[] = [
  { id: 1, name: "Anna Lindgren", email: "anna@hammarby.se", status: "Aktiv", joined: "2025-01-15" },
  { id: 2, name: "Erik Svensson", email: "erik@hammarby.se", status: "Aktiv", joined: "2025-02-03" },
  { id: 3, name: "Sofia Karlsson", email: "sofia@hammarby.se", status: "Aktiv", joined: "2025-02-18" },
  { id: 4, name: "Oscar Björk", email: "oscar@hammarby.se", status: "Aktiv", joined: "2025-03-01" },
  { id: 5, name: "Maja Holm", email: "maja@hammarby.se", status: "Inbjuden", joined: "2025-03-20" },
  { id: 6, name: "Liam Ekström", email: "liam@hammarby.se", status: "Aktiv", joined: "2025-03-22" },
  { id: 7, name: "Ella Nilsson", email: "ella@hammarby.se", status: "Inaktiv", joined: "2024-11-10" },
  { id: 8, name: "Hugo Andersson", email: "hugo@hammarby.se", status: "Aktiv", joined: "2025-01-28" },
];

// API role enum → Swedish UI label. Roots doesn't track invite/active state
// per user yet, so the "status" column reflects the user's club role.
const ROLE_LABELS: Record<string, string> = {
  CLUB_ADMIN: "Klubbadmin",
  CLUB_MEMBER: "Aktiv",
  ASSOCIATION_ADMIN: "Föreningsadmin",
  TEAM_LEADER: "Lagansvarig",
  SELLER: "Säljare",
  SALES_REP: "Säljare",
  SALES_ADMIN: "Säljchef",
  INTERNAL_ADMIN: "Admin",
  PUBLIC: "Inbjuden",
};

function statusVariant(status: string) {
  if (status === "Aktiv" || status === "Klubbadmin") return "success" as const;
  if (status === "Inbjuden") return "warning" as const;
  return "secondary" as const;
}

function isoDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function MedlemmarPage() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberRow[]>(FALLBACK_MEMBERS);
  const { toast } = useToast();

  useEffect(() => {
    // API shape: { members: [{ id, email, name, role, createdAt }] }
    // Previously the UI consumed `joined/status` directly — neither field
    // existed in the API response, so every member row looked empty.
    portalFetch("/members", { schema: membersListResponseSchema })
      .then((data) => {
        if (!data.members?.length) return;
        setMembers(
          data.members.map((m) => ({
            id: m.id,
            name: m.name || m.email,
            email: m.email,
            status: ROLE_LABELS[m.role] ?? m.role,
            joined: isoDate(m.createdAt),
          }))
        );
      })
      .catch(() => {});
  }, []);

  const activeCount = members.filter((m) => m.status === "Aktiv").length;
  const pendingInvites = members.filter((m) => m.status === "Inbjuden").length;
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const newThisMonth = members.filter((m) => {
    const d = new Date(m.joined);
    return d.getFullYear() === y && d.getMonth() === mo;
  }).length;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medlemmar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hantera era föreningsmedlemmar.
          </p>
        </div>
        <Button onClick={() => toast("Inbjudningsfunktion kommer snart!")}>
          <UserPlus className="h-4 w-4" />
          Bjud in medlem
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Aktiva medlemmar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{pendingInvites}</p>
                <p className="text-xs text-muted-foreground">Väntande inbjudningar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{newThisMonth}</p>
                <p className="text-xs text-muted-foreground">Nya denna månad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök medlem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Medlem sedan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.joined}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Inga medlemmar hittades.
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
