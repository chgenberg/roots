"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { shareHref } from "@/components/share-templates";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { absoluteLocaleUrl } from "@/i18n/paths";
import { getPublicSiteUrl } from "@/lib/site-url";
import type { Seller } from "@/types/fundraising";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function TeamInviteCard({
  inviteUrl,
  campaignName,
}: {
  inviteUrl: string;
  campaignName: string;
}) {
  const { locale } = useLocale();
  const t = fundraisingPages.teamDashboard[locale];
  const c = fundraisingPages.common[locale];
  const { toast } = useToast();
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const message = tFill(t.inviteMessage, { campaign: campaignName, url: inviteUrl });

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#4A4134", light: "#FFFFFF" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [inviteUrl]);

  async function copyLink() {
    if (await copyText(inviteUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast(c.copyLinkFailed, "error");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        /* avbruten delning: fall tillbaka till kopiering */
      }
    }
    if (await copyText(message)) toast(t.reminderCopied, "success");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/70 p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
        {t.inviteTitle}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{t.inviteHint}</p>
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {qr ? (
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            {/* Data-URL från qrcode; next/image kan inte optimera den. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t.inviteQrAlt} className="h-36 w-36" />
          </div>
        ) : null}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} aria-label={t.invitePlayers} className="text-xs" />
            <Button size="sm" variant="outline" onClick={() => void copyLink()} aria-label={t.copyLink}>
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => void share()}>
              <Share2 className="mr-2 h-4 w-4" />
              {t.nextInvite}
            </Button>
            <Button variant="outline" asChild>
              <a href={shareHref("WHATSAPP", message) ?? "#"} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={shareHref("SMS", message) ?? "#"}>
                <MessageCircle className="mr-2 h-4 w-4" />
                SMS
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function NotStartedCard({ sellers }: { sellers: Seller[] }) {
  const { locale } = useLocale();
  const t = fundraisingPages.teamDashboard[locale];
  const c = fundraisingPages.common[locale];
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const idle = sellers.filter((s) => s.status !== "INACTIVE" && s.orderCount === 0);
  if (idle.length === 0) return null;

  async function copyReminder(seller: Seller) {
    const url = absoluteLocaleUrl(getPublicSiteUrl(), `/shop/${seller.shopSlug}`, locale);
    const firstName = seller.displayName.split(/\s+/)[0] || seller.displayName;
    if (await copyText(tFill(t.reminderMessage, { name: firstName, url }))) {
      setCopiedId(seller.id);
      setTimeout(() => setCopiedId((cur) => (cur === seller.id ? null : cur)), 2000);
    } else {
      toast(c.copyLinkFailed, "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t.notStartedTitle} ({idle.length})
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{t.notStartedHint}</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {idle.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <p className="min-w-0 truncate text-sm font-medium">{s.displayName}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 text-xs"
                onClick={() => void copyReminder(s)}
              >
                {copiedId === s.id ? (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="mr-1 h-3.5 w-3.5" />
                )}
                {copiedId === s.id ? t.reminderCopied : t.copyReminder}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
