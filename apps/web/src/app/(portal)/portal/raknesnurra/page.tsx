"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type CalculatorInputs,
  type CalculatorResult,
} from "@roots/contracts";
import { RevenueCalculator } from "@/components/calculator/revenue-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { portalFetch } from "@/lib/portal-api";
import {
  Calculator,
  Copy,
  Check,
  Link2,
  Eye,
  Mail,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

interface CalcLink {
  id: string;
  token: string;
  shareUrl: string;
  associationName: string;
  presets: CalculatorInputs;
  viewCount: number;
  leadCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

interface CalcLead {
  id: string;
  email: string;
  contactName: string | null;
  message: string | null;
  newsletterConsent: boolean;
  computedEarningsOre: number;
  inputs: CalculatorInputs | null;
  result: CalculatorResult | null;
  createdAt: string;
}

export default function RaknesnurraPage() {
  const { locale } = useLocale();
  const t = portalPages.raknesnurra[locale];
  const shared = portalShared[locale];
  const { toast } = useToast();
  const [current, setCurrent] = useState<CalculatorInputs | null>(null);
  const [assocName, setAssocName] = useState("");
  const [links, setLinks] = useState<CalcLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openLeads, setOpenLeads] = useState<string | null>(null);
  const [leads, setLeads] = useState<Record<string, CalcLead[]>>({});

  const onCalcChange = useCallback((inputs: CalculatorInputs) => {
    setCurrent(inputs);
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      const data = await portalFetch<{ links: CalcLink[] }>("/calculators");
      setLinks(data.links);
    } catch {
      // empty list is ok
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  async function createLink() {
    if (!current) return;
    if (assocName.trim().length < 2) {
      toast(t.nameRequired, "error");
      return;
    }
    setCreating(true);
    try {
      await portalFetch("/calculators", {
        method: "POST",
        body: { associationName: assocName.trim(), presets: current },
      });
      setAssocName("");
      toast(t.linkCreated, "success");
      await loadLinks();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : t.linkCreateFail,
        "error"
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: CalcLink) {
    try {
      await navigator.clipboard.writeText(link.shareUrl);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((v) => (v === link.id ? null : v)), 2000);
    } catch {
      toast(t.copyFail, "error");
    }
  }

  async function removeLink(link: CalcLink) {
    if (!window.confirm(tFill(t.removeConfirm, { name: link.associationName })))
      return;
    try {
      await portalFetch(`/calculators/${link.id}`, { method: "DELETE" });
      toast(t.linkRemoved, "success");
      await loadLinks();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : t.removeFail,
        "error"
      );
    }
  }

  async function toggleLeads(link: CalcLink) {
    if (openLeads === link.id) {
      setOpenLeads(null);
      return;
    }
    setOpenLeads(link.id);
    if (!leads[link.id]) {
      try {
        const data = await portalFetch<{ leads: CalcLead[] }>(
          `/calculators/${link.id}/leads`
        );
        setLeads((prev) => ({ ...prev, [link.id]: data.leads }));
      } catch {
        setLeads((prev) => ({ ...prev, [link.id]: [] }));
      }
    }
  }

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <RevenueCalculator onChange={onCalcChange} />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold">{t.createLinkTitle}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t.createLinkBody}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="assoc">{t.assocName}</Label>
              <Input
                id="assoc"
                value={assocName}
                onChange={(e) => setAssocName(e.target.value)}
                placeholder={t.assocPlaceholder}
                maxLength={160}
              />
            </div>
            <Button onClick={createLink} disabled={creating || !current}>
              {creating ? t.creating : t.createLink}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">{t.yourLinks}</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noLinks}</p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{link.associationName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {link.shareUrl}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {tFill(t.views, { count: link.viewCount })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {tFill(t.leads, { count: link.leadCount })}
                        </span>
                        <span>
                          {new Date(link.createdAt).toLocaleDateString(
                            shared.dateLocale
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyLink(link)}
                      >
                        {copiedId === link.id ? (
                          <>
                            <Check className="h-4 w-4" /> {t.copied}
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" /> {t.copy}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleLeads(link)}
                        disabled={link.leadCount === 0}
                      >
                        {t.leadsBtn}
                        <ChevronDown
                          className={
                            openLeads === link.id ? "rotate-180" : undefined
                          }
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLink(link)}
                        aria-label={t.removeAria}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {openLeads === link.id && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {(leads[link.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t.noLeads}
                        </p>
                      ) : (
                        (leads[link.id] ?? []).map((lead) => (
                          <div
                            key={lead.id}
                            className="rounded-lg bg-brand-50/50 p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                {lead.contactName
                                  ? `${lead.contactName} · ${lead.email}`
                                  : lead.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(lead.createdAt).toLocaleString(
                                  shared.dateLocale
                                )}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tFill(t.computedEarnings, {
                                amount: formatKr(
                                  lead.computedEarningsOre,
                                  locale
                                ),
                                sellers: lead.inputs
                                  ? tFill(t.sellersSuffix, {
                                      count: lead.inputs.sellers,
                                    })
                                  : "",
                              })}
                            </p>
                            {lead.message && (
                              <p className="mt-1 text-xs">
                                &bdquo;{lead.message}&rdquo;
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
