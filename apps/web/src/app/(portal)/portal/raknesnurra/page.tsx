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
      // tom lista är ok
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
      toast("Ange föreningens namn först.", "error");
      return;
    }
    setCreating(true);
    try {
      await portalFetch("/calculators", {
        method: "POST",
        body: { associationName: assocName.trim(), presets: current },
      });
      setAssocName("");
      toast("Delbar länk skapad.", "success");
      await loadLinks();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Kunde inte skapa länken.",
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
      toast("Kunde inte kopiera. Markera och kopiera manuellt.", "error");
    }
  }

  async function removeLink(link: CalcLink) {
    if (!window.confirm(`Ta bort länken för ${link.associationName}?`)) return;
    try {
      await portalFetch(`/calculators/${link.id}`, { method: "DELETE" });
      toast("Länken togs bort.", "success");
      await loadLinks();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Kunde inte ta bort länken.",
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
          <h1 className="text-2xl font-bold tracking-tight">Räknesnurra</h1>
          <p className="text-sm text-muted-foreground">
            Visa föreningar hur mycket de kan tjäna — live i mötet eller via en
            länk de räknar på själva.
          </p>
        </div>
      </div>

      {/* Live-kalkyl */}
      <RevenueCalculator onChange={onCalcChange} />

      {/* Skapa delbar länk */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold">Skapa delbar länk</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Spara antagandena ovan som en länk du kan skicka till föreningen. De
            kan räkna själva utan att logga in — och du får en notis när de
            lämnar sina uppgifter.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="assoc">Föreningens namn</Label>
              <Input
                id="assoc"
                value={assocName}
                onChange={(e) => setAssocName(e.target.value)}
                placeholder="t.ex. Sundsvalls IF"
                maxLength={160}
              />
            </div>
            <Button onClick={createLink} disabled={creating || !current}>
              {creating ? "Skapar…" : "Skapa länk"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista över länkar */}
      <div className="space-y-3">
        <h2 className="font-semibold">Dina länkar</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inga länkar ännu. Skapa din första ovan.
          </p>
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
                          {link.viewCount} visningar
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {link.leadCount} leads
                        </span>
                        <span>
                          {new Date(link.createdAt).toLocaleDateString("sv-SE")}
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
                            <Check className="h-4 w-4" /> Kopierad
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" /> Kopiera
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleLeads(link)}
                        disabled={link.leadCount === 0}
                      >
                        Leads
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
                        aria-label="Ta bort länk"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {openLeads === link.id && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {(leads[link.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Inga leads ännu.
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
                                  "sv-SE"
                                )}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Räknade på {formatKr(lead.computedEarningsOre)} i
                              förtjänst
                              {lead.inputs
                                ? ` (${lead.inputs.sellers} säljare)`
                                : ""}
                              .
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
