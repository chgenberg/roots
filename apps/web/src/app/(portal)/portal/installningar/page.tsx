"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePortalUser } from "@/lib/portal-context";
import { Shield, Bell, Palette, AlertTriangle, KeyRound } from "lucide-react";
import { MfaSection } from "@/components/mfa-section";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { broadcastLogout } from "@/lib/use-cross-tab-logout";
import { useLocale } from "@/i18n/locale-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import type { Locale } from "@/i18n/config";

function getRoleMeta(
  role: string,
  t: (typeof portalPages)["installningar"][Locale]
) {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER")
    return { label: t.roleClub, description: t.roleClubDesc, color: "bg-brand-50 text-brand-600" };
  if (role === "SALES_REP" || role === "SALES_ADMIN")
    return { label: t.roleSeller, description: t.roleSellerDesc, color: "bg-brand-50 text-brand-600" };
  return { label: t.roleAdmin, description: t.roleAdminDesc, color: "bg-brand-50 text-brand-600" };
}

function BytLosenordDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { locale } = useLocale();
  const t = portalPages.installningar[locale];
  const common = appCommon[locale];

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setCurrent("");
    setNext("");
    setConfirmNext("");
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    if (!current || !next) {
      setError(t.pwdBothRequired);
      return;
    }
    if (next.length < 8) {
      setError(t.pwdMinLength);
      return;
    }
    if (next !== confirmNext) {
      setError(t.pwdMismatch);
      return;
    }
    if (next === current) {
      setError(t.pwdSame);
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data, status } = await apiFetch<{ error?: string }>(
        "/v1/auth/change-password",
        {
          method: "POST",
          body: { currentPassword: current, newPassword: next },
        }
      );
      if (!ok) {
        setError(
          data?.error ||
            (status === 401
              ? t.pwdWrongCurrent
              : tFill(t.pwdChangeFail, { status }))
        );
        return;
      }
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.pwdChangeFailGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.pwdTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="pwd-current">{t.pwdCurrent}</Label>
            <Input
              id="pwd-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-new">{t.pwdNew}</Label>
            <Input
              id="pwd-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-confirm">{t.pwdConfirm}</Label>
            <Input
              id="pwd-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmNext}
              onChange={(e) => setConfirmNext(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t.pwdSaving : t.pwdSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RaderaKontoDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { locale } = useLocale();
  const t = portalPages.installningar[locale];
  const common = appCommon[locale];
  const confirmWord = t.delConfirmWord;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError(t.delPasswordRequired);
      return;
    }
    if (confirm !== confirmWord) {
      setError(t.delConfirmMismatch);
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data, status } = await apiFetch<{
        error?: string;
        scheduledDeletionAt?: string;
        cooldownDays?: number;
      }>("/v1/auth/delete-account", {
        method: "POST",
        body: { password, confirm },
      });
      if (!ok) {
        setError(
          data?.error ||
            (status === 401
              ? t.delWrongPassword
              : tFill(t.delFail, { status }))
        );
        return;
      }
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.delFailGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t.delTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-2">
            <div className="rounded-lg bg-warning-surface p-3 text-xs text-warning-strong">
              <p className="font-medium">{t.delWarningTitle}</p>
              <p className="mt-1 text-warning-strong/80">{t.delWarningBody}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="del-password">{t.delPassword}</Label>
              <Input
                id="del-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="del-confirm">{t.delConfirmLabel}</Label>
              <Input
                id="del-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={confirmWord}
                required
              />
            </div>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="px-6 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {common.cancel}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting || confirm !== confirmWord}
            >
              {submitting ? t.delSending : t.delSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeletionStatus {
  status: "none" | "scheduled" | "deleted" | "unknown";
  scheduledDeletionAt?: string;
  requestedAt?: string;
}

export default function InstallningarPage() {
  const user = usePortalUser();
  const router = useRouter();
  const { locale, href } = useLocale();
  const t = portalPages.installningar[locale];
  const shared = portalShared[locale];
  const { toast } = useToast();
  const roleMeta = getRoleMeta(user.role, t);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delStatus, setDelStatus] = useState<DeletionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<DeletionStatus>("/v1/auth/deletion-status").then(({ ok, data }) => {
      if (cancelled) return;
      if (ok && data) setDelStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDeletionSuccess() {
    toast(t.deletionConfirmToast);
    broadcastLogout();
    setTimeout(() => router.replace(href("/login")), 400);
  }

  async function handleCancelDeletion() {
    const { ok, data } = await apiFetch<{ error?: string }>(
      "/v1/auth/cancel-deletion",
      { method: "POST", body: {} }
    );
    if (!ok) {
      toast(data?.error ?? t.cancelDeletionFail);
      return;
    }
    toast(t.cancelDeletionOk);
    setDelStatus({ status: "none" });
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t.accountInfo}</h2>
          </div>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-name">{t.name}</Label>
              <Input id="settings-name" value={user.name} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">{t.email}</Label>
              <Input id="settings-email" value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-org">{t.organisation}</Label>
              <Input id="settings-org" value={user.orgName} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-role">{t.role}</Label>
              <div className="flex items-center gap-3">
                <Input id="settings-role" value={user.role} readOnly className="flex-1" />
                <Badge className={cn("shrink-0", roleMeta.color)}>
                  {roleMeta.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-brand-50/50 p-4">
            <p className="text-sm font-medium">{roleMeta.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleMeta.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t.notifications}</h2>
          </div>
          <Separator />
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{t.emailNotices}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.emailNoticesBody.includes("info@roots.nu") ? (
                  <>
                    {t.emailNoticesBody.split("info@roots.nu")[0]}
                    <a
                      href="mailto:info@roots.nu"
                      className="underline underline-offset-2"
                    >
                      info@roots.nu
                    </a>
                    {t.emailNoticesBody.split("info@roots.nu")[1]}
                  </>
                ) : (
                  t.emailNoticesBody
                )}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium">{t.deliveryNotices}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.deliveryNoticesBody}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t.mfaTitle}</h2>
          </div>
          <Separator />
          <MfaSection />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t.account}</h2>
          </div>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setPwdOpen(true)}>
              {t.changePassword}
            </Button>
            {delStatus?.status === "scheduled" ? (
              <Button variant="outline" onClick={handleCancelDeletion}>
                {t.cancelDeletion}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setDelOpen(true)}
              >
                {t.deleteAccount}
              </Button>
            )}
          </div>

          {delStatus?.status === "scheduled" && delStatus.scheduledDeletionAt && (
            <div
              role="status"
              className="rounded-lg border border-warning-edge bg-warning-surface p-4 text-sm text-warning-strong"
            >
              <p className="font-medium">{t.scheduledTitle}</p>
              <p className="mt-1 text-warning-strong/80">
                {tFill(t.scheduledBody, {
                  date: new Date(delStatus.scheduledDeletionAt).toLocaleDateString(
                    shared.dateLocale,
                    { day: "numeric", month: "long", year: "numeric" }
                  ),
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <BytLosenordDialog
        open={pwdOpen}
        onOpenChange={setPwdOpen}
        onSuccess={() => toast(t.passwordUpdated)}
      />
      <RaderaKontoDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        onSuccess={handleDeletionSuccess}
      />
    </div>
  );
}
