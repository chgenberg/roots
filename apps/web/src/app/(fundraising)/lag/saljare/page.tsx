"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  ExternalLink,
  Loader2,
  Trophy,
  Copy,
  CheckCircle2,
  UserPlus,
  Upload,
  Eye,
  EyeOff,
  Target,
  X,
  Pause,
  Play,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { GradeBadge, GradeProgress } from "@/components/seller-grade";
import { SellerImportDialog } from "@/components/seller-import-dialog";
import type { TeamDashboard, Seller } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api";
import { formatKrValue } from "@/lib/format";

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const PODIUM_ICONS = ["🥇", "🥈", "🥉"];

export default function TeamSellersPage() {
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedShop, setCopiedShop] = useState<string | null>(null);
  const { toast } = useToast();

  // Inline create seller state
  const [showCreate, setShowCreate] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Sprint E10: inline goal-edit per seller. Only one row can be in
  // edit-mode at a time (`editingGoalId`); `editGoalValue` is the draft
  // value, `savingGoalId` flips while the PATCH is in flight.
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalValue, setEditGoalValue] = useState<string>("");
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  // Sprint E12: pause/activate state.
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  async function toggleStatus(seller: Seller) {
    const next = seller.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
    setStatusBusyId(seller.id);
    try {
      const res = await apiFetch<{ id?: string; status?: string; error?: string }>(
        `/v1/dashboard/sellers/${seller.id}`,
        {
          method: "PATCH",
          body: { status: next },
        }
      );
      if (res.ok && res.data?.id) {
        toast(
          next === "INACTIVE"
            ? `${seller.displayName} är pausad och syns inte i topplistan.`
            : `${seller.displayName} är aktiv igen.`,
          "success"
        );
        setData((prev) =>
          prev
            ? {
                ...prev,
                sellers: prev.sellers.map((s) =>
                  s.id === seller.id ? { ...s, status: next } : s
                ),
              }
            : prev
        );
      } else {
        toast(res.data?.error || "Kunde inte uppdatera status.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setStatusBusyId(null);
    }
  }

  function startEditGoal(seller: Seller) {
    setEditingGoalId(seller.id);
    setEditGoalValue(String(seller.individualGoal ?? 0));
  }

  function cancelEditGoal() {
    setEditingGoalId(null);
    setEditGoalValue("");
  }

  async function saveGoal(sellerId: string) {
    const parsed = Number.parseInt(editGoalValue, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast("Målbeloppet måste vara ett positivt heltal.", "error");
      return;
    }
    if (parsed > 10_000_000) {
      toast("Målbeloppet är orimligt högt.", "error");
      return;
    }
    setSavingGoalId(sellerId);
    try {
      const res = await apiFetch<{
        id?: string;
        individualGoal?: number;
        error?: string;
      }>(`/v1/dashboard/sellers/${sellerId}`, {
        method: "PATCH",
        body: { individualGoal: parsed },
      });
      if (res.ok && res.data?.id) {
        toast("Mål uppdaterat.", "success");
        setData((prev) =>
          prev
            ? {
                ...prev,
                sellers: prev.sellers.map((s) =>
                  s.id === sellerId
                    ? { ...s, individualGoal: res.data!.individualGoal ?? parsed }
                    : s
                ),
              }
            : prev
        );
        cancelEditGoal();
      } else {
        toast(res.data?.error || "Kunde inte uppdatera mål.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setSavingGoalId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const myTeamRes = await fetch(`${API_URL}/v1/dashboard/my-team`, {
        credentials: "include",
      });
      if (!myTeamRes.ok) {
        setError("Kunde inte hämta lagdata. Försök igen.");
        return;
      }
      const { teamId } = await myTeamRes.json();

      const teamRes = await fetch(
        `${API_URL}/v1/dashboard/team/${teamId}`,
        { credentials: "include" }
      );
      if (teamRes.ok) {
        setData(await teamRes.json());
      } else {
        setError("Kunde inte hämta lagdata. Försök igen.");
      }
    } catch {
      setError("Ett nätverksfel uppstod. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  function copyInviteLink() {
    if (!data?.team?.inviteToken) return;
    try {
      navigator.clipboard.writeText(
        `${SITE_URL}/registrera/saljare/${data.team.inviteToken}`
      );
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  function copyShopLink(slug: string) {
    try {
      navigator.clipboard.writeText(`${SITE_URL}/shop/${slug}`);
      setCopiedShop(slug);
      setTimeout(() => setCopiedShop(null), 2000);
    } catch {
      toast("Kunde inte kopiera länken. Kopiera den manuellt.", "error");
    }
  }

  async function handleCreateSeller(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.team?.id || !createName || !createEmail || !createPassword) return;
    setCreating(true);

    try {
      // apiFetch attaches CSRF + cookies so the POST passes the API's
      // CSRF middleware in production.
      const res = await apiFetch<{ ok?: boolean; seller?: Seller; error?: string }>(
        `/v1/dashboard/team/${data.team.id}/sellers`,
        {
          method: "POST",
          body: {
            displayName: createName,
            email: createEmail,
            password: createPassword,
          },
        }
      );

      if (res.ok && res.data?.ok && res.data.seller) {
        const newSeller = res.data.seller;
        toast("Säljare tillagd!", "success");
        setCreateName("");
        setCreateEmail("");
        setCreatePassword("");
        setShowCreate(false);
        setData((prev) =>
          prev
            ? { ...prev, sellers: [...prev.sellers, newSeller] }
            : prev
        );
      } else {
        toast(res.data?.error || "Kunde inte skapa säljare.", "error");
      }
    } catch {
      toast("Ett nätverksfel uppstod.", "error");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Försök igen
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Users className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Inget lag hittades</p>
      </div>
    );
  }

  const sellers: Seller[] = data.sellers || [];
  // Sprint E12: paused sellers must not appear in the topplistan/ranking
  // but are still listed below in a dedicated "Pausade säljare" section
  // so the team leader can see and reactivate them.
  const activeSellers = sellers.filter((s) => s.status !== "INACTIVE");
  const pausedSellers = sellers.filter((s) => s.status === "INACTIVE");
  const sortedSellers = [...activeSellers].sort(
    (a, b) => b.totalSalesOre - a.totalSalesOre
  );

  const topThree = sortedSellers.slice(0, 3);

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Säljare</h1>
          <p className="text-sm text-muted-foreground">
            {sellers.length} säljare i {data.team?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Importera
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className="gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            Lägg till
          </Button>
        </div>
      </div>

      {data?.team?.id && (
        <SellerImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          teamId={data.team.id}
          onImported={load}
        />
      )}

      {/* Inline create seller */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-brand-500" />
              Lägg till säljare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSeller} className="space-y-3">
              <Input
                placeholder="Namn (t.ex. Kalle Svensson)"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="E-post"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Lösenord"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating} size="sm">
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Skapa konto
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite link */}
      {data?.team?.inviteToken && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium">
              Eller dela inbjudningslänken
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${SITE_URL}/registrera/saljare/${data.team.inviteToken}`}
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={copyInviteLink}>
                {copiedInvite ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Podium for top 3 */}
      {topThree.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-brand-500" />
              Topplista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-center gap-4 pb-4 pt-2">
              {topThree.map((seller, i) => {
                const isFirst = i === 0;
                return (
                  <div
                    key={seller.id}
                    className={`flex flex-col items-center gap-2 ${
                      isFirst ? "order-2" : i === 1 ? "order-1" : "order-3"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center rounded-full bg-brand-50 ${
                        isFirst ? "h-16 w-16 text-3xl" : "h-12 w-12 text-2xl"
                      }`}
                    >
                      {PODIUM_ICONS[i]}
                    </div>
                    <div className="text-center">
                      <p
                        className={`font-semibold ${
                          isFirst ? "text-sm" : "text-xs"
                        }`}
                      >
                        {seller.displayName}
                      </p>
                      <p className="text-xs font-bold text-brand-700">
                        {formatKrValue(seller.totalSalesOre)} kr
                      </p>
                      <GradeBadge grade={seller.grade} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full ranking list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alla säljare</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga säljare har anslutit ännu. Lägg till eller dela inbjudningslänken!
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSellers.map((seller, i) => (
                <div
                  key={seller.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center shrink-0 text-sm font-bold ${
                        i < 3 ? "text-brand-700" : "text-muted-foreground"
                      }`}
                    >
                      {i < 3 ? PODIUM_ICONS[i] : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {seller.displayName}
                        </p>
                        <GradeBadge grade={seller.grade} size="sm" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {seller.orderCount} ordrar
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0">
                      {formatKrValue(seller.totalSalesOre)} kr
                    </p>
                  </div>

                  <GradeProgress grade={seller.grade} className="ml-9" />

                  {/* Goal section — Sprint E10 added inline edit. The
                      progress bar shows up only when a goal is set; the
                      "Sätt mål"-link appears otherwise so the leader can
                      give a brand-new seller a target. */}
                  <div className="ml-9">
                    {editingGoalId === seller.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={editGoalValue}
                          onChange={(e) => setEditGoalValue(e.target.value)}
                          className="h-8 max-w-[120px] text-xs"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">
                          kr
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => saveGoal(seller.id)}
                          disabled={savingGoalId === seller.id}
                        >
                          {savingGoalId === seller.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Spara"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={cancelEditGoal}
                          disabled={savingGoalId === seller.id}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : seller.individualGoal != null &&
                      seller.individualGoal > 0 ? (
                      <div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-brand-100 mt-1">
                          <div
                            className="h-full rounded-full bg-brand-700 transition-all duration-700"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (seller.totalSalesOre /
                                    (seller.individualGoal * 100)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            Mål:{" "}
                            {(seller.totalSalesOre / 100).toLocaleString(
                              "sv-SE"
                            )}{" "}
                            / {seller.individualGoal.toLocaleString("sv-SE")} kr
                          </p>
                          <button
                            type="button"
                            onClick={() => startEditGoal(seller)}
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
                          >
                            <Target className="h-3 w-3" />
                            Ändra
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditGoal(seller)}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
                      >
                        <Target className="h-3 w-3" />
                        Sätt mål
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 ml-9">
                    {seller.shopSlug && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => copyShopLink(seller.shopSlug)}
                        >
                          {copiedShop === seller.shopSlug ? (
                            <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1" />
                          )}
                          Kopiera shop-länk
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a
                            href={`${SITE_URL}/shop/${seller.shopSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Öppna shop
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => void toggleStatus(seller)}
                      disabled={statusBusyId === seller.id}
                    >
                      {statusBusyId === seller.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Pause className="h-3 w-3 mr-1" />
                      )}
                      Pausa
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paused sellers (hidden from ranking) */}
      {pausedSellers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pause className="h-4 w-4 text-muted-foreground" />
              Pausade säljare ({pausedSellers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pausedSellers.map((seller) => (
                <div
                  key={seller.id}
                  className="rounded-lg border border-dashed p-4 space-y-2 opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {seller.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pausad — räknas inte i ranking eller måluppfyllelse.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => void toggleStatus(seller)}
                      disabled={statusBusyId === seller.id}
                    >
                      {statusBusyId === seller.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      Aktivera
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
