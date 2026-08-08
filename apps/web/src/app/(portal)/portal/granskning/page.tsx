"use client";

/**
 * INTERNAL_ADMIN — granska självregistrerade föreningar innan de får ta
 * emot publika betalningar. Backas av:
 *   GET  /v1/admin/organizations/pending
 *   POST /v1/admin/organizations/:orgId/approve
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import {
  Loader2,
  Building2,
  CheckCircle2,
  RefreshCw,
  Mail,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

interface Contact {
  email: string;
  name: string | null;
  phone: string | null;
}

interface PendingOrg {
  id: string;
  name: string;
  orgNumber: string | null;
  nationalFederation: string | null;
  sportType: string | null;
  createdAt: string;
  contacts: Contact[];
}

function formatDate(iso: string, dateLocale: string): string {
  try {
    return new Date(iso).toLocaleString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function GranskningPage() {
  const { locale } = useLocale();
  const t = portalPages.granskning[locale];
  const shared = portalShared[locale];
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<PendingOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ organizations?: PendingOrg[]; error?: string }>(
        "/v1/admin/organizations/pending"
      );
      if (!res.ok) {
        setError(
          res.status === 403
            ? shared.permissionDenied
            : res.data?.error || t.loadError
        );
        setOrgs([]);
        return;
      }
      setOrgs(res.data.organizations ?? []);
    } catch {
      setError(shared.networkServer);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [shared.networkServer, shared.permissionDenied, t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(orgId: string, approved: boolean) {
    setActingId(orgId);
    try {
      const res = await apiFetch<{ error?: string; organization?: { name: string } }>(
        `/v1/admin/organizations/${orgId}/approve`,
        { method: "POST", body: { approved } }
      );
      if (!res.ok) {
        toast(res.data?.error || t.updateFail, "error");
        return;
      }
      toast(
        approved ? t.approvedToast : t.revokedToast,
        "success"
      );
      setOrgs((prev) => prev.filter((o) => o.id !== orgId));
    } catch {
      toast(shared.networkError, "error");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {shared.refresh}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && !orgs.length ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      ) : null}

      {!loading && !error && orgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-brand-500" />
            <div>
              <p className="font-medium">{t.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {orgs.map((org) => {
          const busy = actingId === org.id;
          return (
            <Card key={org.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                      <Building2 className="h-5 w-5 text-brand-700" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{org.name}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tFill(t.registered, {
                          date: formatDate(org.createdAt, shared.dateLocale),
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {org.orgNumber ? (
                          <Badge variant="outline">
                            {tFill(t.orgNumber, { number: org.orgNumber })}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t.orgNumberMissing}</Badge>
                        )}
                        {org.sportType ? (
                          <Badge variant="outline">{org.sportType}</Badge>
                        ) : null}
                        {org.nationalFederation ? (
                          <Badge variant="outline">{org.nationalFederation}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void approve(org.id, true)}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {t.approve}
                  </Button>
                </div>

                {(org.contacts ?? []).length > 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t.contacts}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(org.contacts ?? []).map((c) => (
                        <li
                          key={`${c.email}-${c.name ?? ""}`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                        >
                          <span className="font-medium">
                            {c.name || t.nameMissing}
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {c.email}
                          </span>
                          {c.phone ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {c.phone}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.noContacts}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
