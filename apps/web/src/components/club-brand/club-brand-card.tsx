"use client";

import { useEffect, useState } from "react";
import { Loader2, Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import type { OrgBrand } from "@/lib/club-brand/theme";
import { clubBrand } from "@/i18n/dictionaries/club-brand";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { useLocale } from "@/i18n/locale-context";
import { ClubBrandPicker, draftFromBrand, type BrandDraft } from "./club-brand-picker";

/** Skalet lyssnar och läser om profilen när den sparats. */
export const CLUB_BRAND_EVENT = "roots:club-brand";

/** Webbplats, logga och färger för en förening — läs, justera och spara. */
export function ClubBrandCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { locale } = useLocale();
  const t = clubBrand[locale];
  const common = appCommon[locale];
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState<OrgBrand | null>(null);
  const [draft, setDraft] = useState<BrandDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ website: string | null; brand: OrgBrand | null }>(`/v1/brand/org/${orgId}`)
      .then((res) => {
        if (cancelled || !res.ok) return;
        setWebsite(res.data.website ?? "");
        setSaved(res.data.brand);
        setDraft(draftFromBrand(res.data.brand));
      })
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ brand?: OrgBrand | null; error?: string }>(`/v1/brand/org/${orgId}`, {
        method: "PUT",
        body: {
          website: website.trim() || null,
          ...(draft ?? { color: null, colors: [], logo: null, logoOnDark: false }),
        },
      });
      if (res.ok) {
        setSaved(res.data.brand ?? null);
        setDraft(draftFromBrand(res.data.brand));
        window.dispatchEvent(new Event(CLUB_BRAND_EVENT));
        toast(t.saved, "success");
      } else {
        toast(res.data?.error || common.somethingWrong, "error");
      }
    } catch {
      toast(common.networkError, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          {t.sectionTitle}
        </CardTitle>
        <CardDescription>{t.sectionBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="clubWebsite">{t.websiteLabel}</Label>
            <Input
              id="clubWebsite"
              inputMode="url"
              autoComplete="url"
              placeholder="www.foreningen.se"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <ClubBrandPicker
            website={website}
            clubName={orgName}
            value={draft}
            onChange={setDraft}
            saved={saved}
            auto={false}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
