"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import {
  membersListResponseSchema,
  inviteMemberResponseSchema,
} from "@roots/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

// ── Bjud in medlem-dialogen (Sprint C) ─────────────────────────────
// Minimal-friction invite: email + optional name + role (CLUB_MEMBER by
// default). The new user lands in the DB immediately with a non-loginable
// passwordHash so they show up in the table; a follow-up MVP adds a
// token-link email so they can set a real password.
function BjudInMedlemDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (row: MemberRow) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"CLUB_MEMBER" | "CLUB_ADMIN">(
    "CLUB_MEMBER"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setName("");
    setRole("CLUB_MEMBER");
    setError(null);
  }, [open]);

  async function handleSubmit() {
    setError(null);
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError("Ange en giltig e-postadress.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await portalFetch("/members/invite", {
        method: "POST",
        schema: inviteMemberResponseSchema,
        body: { email: cleanedEmail, contactName: name.trim() || undefined, role },
      });
      onInvited({
        id: data.member.id,
        name: data.member.name || data.member.email,
        email: data.member.email,
        status: ROLE_LABELS[data.member.role] ?? data.member.role,
        joined: isoDate(data.member.createdAt),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte bjuda in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bjud in medlem</DialogTitle>
        </DialogHeader>
        {/* MASTERPLAN_01 KC6.8: wrap fält + footer i <form> så Enter
            submitar inbjudan via native form-submit. Mobile-keyboarden
            visar nu "Go" som faktiskt fungerar. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting) handleSubmit();
          }}
          noValidate
        >
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-postadress</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@klubb.se"
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Namn (valfritt)</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anna Lindgren"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label>Roll</Label>
              <div className="flex gap-2" role="group" aria-label="Välj roll">
                <Button
                  type="button"
                  variant={role === "CLUB_MEMBER" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole("CLUB_MEMBER")}
                >
                  Medlem
                </Button>
                <Button
                  type="button"
                  variant={role === "CLUB_ADMIN" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole("CLUB_ADMIN")}
                >
                  Klubbadmin
                </Button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Bjuder in…" : "Skicka inbjudan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MedlemmarPage() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // API shape: { members: [{ id, email, name, role, createdAt }] }
    portalFetch("/members", { schema: membersListResponseSchema })
      .then((data) => {
        setMembers(
          (data.members ?? []).map((m) => ({
            id: m.id,
            name: m.name || m.email,
            email: m.email,
            status: ROLE_LABELS[m.role] ?? m.role,
            joined: isoDate(m.createdAt),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Bjud in medlem
        </Button>
      </div>

      <BjudInMedlemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInvited={(row) => {
          setMembers((prev) => [row, ...prev]);
          toast(`${row.name} har bjudits in.`);
        }}
      />

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
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {members.length === 0
                      ? "Ingen medlem är registrerad ännu. Bjud in den första medlemmen för att komma igång."
                      : "Inga medlemmar matchade sökningen."}
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Hämtar medlemmar…
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
