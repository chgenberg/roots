"use client";

/**
 * Sprint E12: ready-made share copy for the seller's personal shop.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Copy,
  CheckCircle2,
  MessageCircle,
  Mail,
  Instagram,
  Facebook,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

interface ShareTemplate {
  id: string;
  label: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "INSTAGRAM" | "FACEBOOK";
  icon: React.ComponentType<{ className?: string }>;
  body: string;
  subject?: string;
}

function shareHref(
  channel: ShareTemplate["channel"],
  body: string,
  subject?: string
): string | null {
  const enc = encodeURIComponent(body);
  if (channel === "SMS") return `sms:?&body=${enc}`;
  if (channel === "WHATSAPP") return `https://wa.me/?text=${enc}`;
  if (channel === "EMAIL") {
    const subj = subject ? `subject=${encodeURIComponent(subject)}&` : "";
    return `mailto:?${subj}body=${enc}`;
  }
  return null;
}

export interface ShareTemplatesProps {
  displayName: string;
  shopUrl: string;
  campaignName: string;
  teamName: string;
}

export function ShareTemplates({
  displayName,
  shopUrl,
  campaignName,
  teamName,
}: ShareTemplatesProps) {
  const { locale } = useLocale();
  const t = fundraisingPages.shareTemplates[locale];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const vars = useMemo(
    () => ({
      displayName,
      shopUrl,
      campaignName,
      teamName,
      hashtag: displayName.replace(/\s+/g, ""),
    }),
    [displayName, shopUrl, campaignName, teamName]
  );

  const templates: ShareTemplate[] = useMemo(
    () => [
      {
        id: "sms-short",
        label: t.labelSmsShort,
        channel: "SMS",
        icon: MessageCircle,
        body: tFill(t.bodySmsShort, vars),
      },
      {
        id: "whatsapp-family",
        label: t.labelWaFamily,
        channel: "WHATSAPP",
        icon: MessageCircle,
        body: tFill(t.bodyWaFamily, vars),
      },
      {
        id: "instagram",
        label: t.labelInstagram,
        channel: "INSTAGRAM",
        icon: Instagram,
        body: tFill(t.bodyInstagram, vars),
      },
      {
        id: "facebook",
        label: t.labelFacebook,
        channel: "FACEBOOK",
        icon: Facebook,
        body: tFill(t.bodyFacebook, vars),
      },
      {
        id: "email-grandparents",
        label: t.labelEmail,
        channel: "EMAIL",
        icon: Mail,
        subject: tFill(t.subjectEmail, vars),
        body: tFill(t.bodyEmail, vars),
      },
      {
        id: "sms-coworkers",
        label: t.labelSmsFriends,
        channel: "SMS",
        icon: MessageCircle,
        body: tFill(t.bodySmsFriends, vars),
      },
    ],
    [t, vars]
  );

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      window.prompt(t.copyPrompt, text);
    }
  }

  function openLabel(channel: ShareTemplate["channel"]) {
    if (channel === "SMS") return "SMS";
    if (channel === "WHATSAPP") return "WhatsApp";
    return locale === "en" ? "Email" : "E-post";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          {t.title}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{t.subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => {
            const href = shareHref(tpl.channel, tpl.body, tpl.subject);
            const Icon = tpl.icon;
            const copied = copiedId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-500 shrink-0" />
                  <p className="text-sm font-medium">{tpl.label}</p>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                  {tpl.body}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => copy(tpl.id, tpl.body)}
                  >
                    {copied ? (
                      <CheckCircle2 className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    {copied ? t.copied : t.copy}
                  </Button>
                  {href && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {t.open} {openLabel(tpl.channel)}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
