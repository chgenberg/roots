"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import { LoadError } from "@/components/load-error";
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
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

interface MemberRow {
  id: string | number;
  name: string;
  email: string;
  role: string;
  joined: string;
}

function statusVariant(role: string) {
  if (role === "CLUB_MEMBER" || role === "CLUB_ADMIN") return "success" as const;
  if (role === "PUBLIC") return "warning" as const;
  return "secondary" as const;
}

function isoDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function BjudInMedlemDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (row: MemberRow) => void;
}) {
  const { locale } = useLocale();
  const t = portalPages.medlemmar[locale];
  const common = appCommon[locale];

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
      setError(t.invalidEmail);
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
        role: data.member.role,
        joined: isoDate(data.member.createdAt),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.inviteFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.inviteTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting) handleSubmit();
          }}
          noValidate
        >
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t.emailLabel}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">{t.nameOptional}</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.roleLabel}</Label>
              <div className="flex gap-2" role="group" aria-label={t.roleAria}>
                <Button
                  type="button"
                  variant={role === "CLUB_MEMBER" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole("CLUB_MEMBER")}
                >
                  {t.roleMember}
                </Button>
                <Button
                  type="button"
                  variant={role === "CLUB_ADMIN" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole("CLUB_ADMIN")}
                >
                  {t.roleAdmin}
                </Button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive" role="alert">
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
              {common.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t.inviting : t.sendInvite}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MedlemmarPage() {
  const { locale } = useLocale();
  const t = portalPages.medlemmar[locale];
  const shared = portalShared[locale];
  const roleLabels = shared.roles;

  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setListError(null);
    portalFetch("/members", { schema: membersListResponseSchema })
      .then((data) => {
        setMembers(
          (data.members ?? []).map((m) => ({
            id: m.id,
            name: m.name || m.email,
            email: m.email,
            role: m.role,
            joined: isoDate(m.createdAt),
          }))
        );
      })
      .catch(() => {
        setListError(t.loadError);
      })
      .finally(() => setLoading(false));
  }, [t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = members.filter((m) => m.role === "CLUB_MEMBER").length;
  const pendingInvites = members.filter((m) => m.role === "PUBLIC").length;
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

  function roleLabel(role: string): string {
    return roleLabels[role as keyof typeof roleLabels] ?? role;
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          {t.invite}
        </Button>
      </div>

      {listError && <LoadError message={listError} onRetry={load} inline />}

      <BjudInMedlemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInvited={(row) => {
          setMembers((prev) => [row, ...prev]);
          toast(tFill(t.invitedToast, { name: row.name }));
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">{t.activeMembers}</p>
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
                <p className="text-xs text-muted-foreground">{t.pendingInvites}</p>
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
                <p className="text-xs text-muted-foreground">{t.newThisMonth}</p>
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
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colName}</TableHead>
                <TableHead>{t.colEmail}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead className="text-right">{t.colJoined}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(m.role)}>
                      {roleLabel(m.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.joined}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {members.length === 0 ? t.empty : t.noMatch}
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {t.loading}
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
