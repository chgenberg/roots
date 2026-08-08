"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import { clubsListResponseSchema } from "@roots/contracts";
import { LoadError } from "@/components/load-error";
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
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";

type CrmStatus = keyof (typeof portalShared)["sv"]["crmStatus"];

interface ClubRow {
  id: string | number;
  name: string;
  members: number | null;
  status: CrmStatus | "LEAD";
  lastOrder: string;
  revenueOre: number;
}

function statusVariant(status: string) {
  if (status === "CUSTOMER") return "success" as const;
  if (status === "LEAD") return "warning" as const;
  return "secondary" as const;
}

function formatSek(ore: number, locale: "sv" | "en"): string {
  if (!ore || ore <= 0) return "—";
  return formatKr(ore, locale);
}

function formatDate(
  iso: string | null | undefined,
  dateLocale: string
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(dateLocale);
}

function crmStatusKey(
  crm: string | null | undefined,
  type: string | null | undefined
): CrmStatus | "LEAD" {
  if (crm === "CUSTOMER") return "CUSTOMER";
  if (crm === "LEAD") return "LEAD";
  if (crm === "PROSPECT") return "PROSPECT";
  if (crm === "INACTIVE") return "INACTIVE";
  if (type === "club") return "CUSTOMER";
  return "LEAD";
}

export default function KlubbarPage() {
  const { locale } = useLocale();
  const t = portalPages.klubbar[locale];
  const shared = portalShared[locale];
  const crmLabels = shared.crmStatus;

  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    portalFetch("/clubs", { schema: clubsListResponseSchema })
      .then((data) => {
        setClubs(
          (data.clubs ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            members: c.membersCount ?? 0,
            status: crmStatusKey(c.crmStatus, c.type),
            lastOrder: formatDate(
              typeof c.lastOrderAt === "string"
                ? c.lastOrderAt
                : c.lastOrderAt instanceof Date
                  ? c.lastOrderAt.toISOString()
                  : null,
              shared.dateLocale
            ),
            revenueOre: c.revenueOre ?? 0,
          }))
        );
      })
      .catch(() => {
        setError(t.loadError);
      })
      .finally(() => setLoading(false));
  }, [shared.dateLocale, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function statusLabel(status: ClubRow["status"]): string {
    return crmLabels[status as keyof typeof crmLabels] ?? status;
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {error && <LoadError message={error} onRetry={load} inline />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{clubs.length}</p>
                <p className="text-xs text-muted-foreground">{t.totalClubs}</p>
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
                  {clubs.filter((c) => c.status === "CUSTOMER").length}
                </p>
                <p className="text-xs text-muted-foreground">{t.activeCustomers}</p>
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
                  {clubs.filter((c) => c.status === "LEAD").length}
                </p>
                <p className="text-xs text-muted-foreground">{t.newLeads}</p>
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
                  {formatSek(
                    clubs.reduce((sum, c) => sum + c.revenueOre, 0),
                    locale
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{t.totalRevenue}</p>
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
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ul className="space-y-3 lg:hidden" aria-label={t.listAria}>
            {filtered.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{c.name}</p>
                  <Badge variant={statusVariant(c.status)}>
                    {statusLabel(c.status)}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{shared.members}</dt>
                    <dd className="font-medium">{c.members ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.lastOrder}</dt>
                    <dd className="truncate">{c.lastOrder}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-muted-foreground">{shared.revenue}</dt>
                    <dd className="font-medium">
                      {formatSek(c.revenueOre, locale)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
            {!loading && filtered.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {clubs.length === 0 ? t.empty : t.noMatch}
              </li>
            )}
            {loading && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t.loading}
              </li>
            )}
          </ul>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colClub}</TableHead>
                  <TableHead>{t.colMembers}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colLastOrder}</TableHead>
                  <TableHead className="text-right">{t.colRevenue}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.members ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>
                        {statusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.lastOrder}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatSek(c.revenueOre, locale)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {clubs.length === 0 ? t.empty : t.noMatch}
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {t.loading}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
