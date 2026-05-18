"use client";

/**
 * Sprint E12: ready-made share copy for the seller's personal shop.
 *
 * Sellers told us in user testing that the hardest part isn't sharing —
 * it's writing the actual message. So we ship six pre-written templates
 * (SMS, Insta caption, Facebook, WhatsApp, email, family WhatsApp) with
 * the seller's name, campaign and shop URL already filled in. One click
 * copies the text. One click opens the right app.
 *
 * Templates intentionally vary in length and tone so a 12-year-old can
 * grab the SMS while a parent can grab the email-to-grandparents.
 */

import { useState } from "react";
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

interface ShareTemplate {
  id: string;
  label: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "INSTAGRAM" | "FACEBOOK";
  icon: React.ComponentType<{ className?: string }>;
  body: (vars: {
    displayName: string;
    shopUrl: string;
    campaignName: string;
    teamName: string;
  }) => string;
  subject?: (vars: {
    displayName: string;
    campaignName: string;
  }) => string;
}

const TEMPLATES: ShareTemplate[] = [
  {
    id: "sms-short",
    label: "SMS · Kort & snabb",
    channel: "SMS",
    icon: MessageCircle,
    body: ({ displayName, shopUrl, campaignName }) =>
      `Hej! Jag säljer Roots schampo och balsam för ${campaignName} 🌱 Köp via min länk så stöttar du mig direkt: ${shopUrl} – Tack! /${displayName}`,
  },
  {
    id: "whatsapp-family",
    label: "WhatsApp · Familj & nära",
    channel: "WHATSAPP",
    icon: MessageCircle,
    body: ({ displayName, shopUrl, campaignName, teamName }) =>
      `Hej! 💛\n\nVi i ${teamName} säljer Roots-produkter för att finansiera ${campaignName}. Det är riktigt bra schampo och balsam som dessutom är svensktillverkat.\n\nKöp via min personliga länk så går pengarna till oss:\n${shopUrl}\n\nTack för att du stöttar! /${displayName}`,
  },
  {
    id: "instagram",
    label: "Instagram · Story / caption",
    channel: "INSTAGRAM",
    icon: Instagram,
    body: ({ displayName, shopUrl, campaignName }) =>
      `Vi säljer Roots ✨\nSchampo och balsam i världsklass, made in Sweden.\nVarje köp via min länk stöttar ${campaignName} – tack! 🙏\n\n👉 ${shopUrl}\n\n#roots #stöttavårtlag #${displayName.replace(/\s+/g, "")} #svensktillverkat`,
  },
  {
    id: "facebook",
    label: "Facebook · Inlägg",
    channel: "FACEBOOK",
    icon: Facebook,
    body: ({ displayName, shopUrl, campaignName, teamName }) =>
      `Hej alla! 👋\n\nVi i ${teamName} har dragit igång vår försäljning för att finansiera ${campaignName}. Vi säljer Roots schampo och balsam – svensktillverkade, riktigt bra produkter som dessutom är prisvärda.\n\nKöp via min personliga länk så går pengarna direkt till oss istället för till mellanhänder:\n${shopUrl}\n\nDela gärna inlägget om du gillar det – varje köp gör skillnad! 💚\n\n/${displayName}`,
  },
  {
    id: "email-grandparents",
    label: "E-post · Mor- & farföräldrar",
    channel: "EMAIL",
    icon: Mail,
    subject: ({ displayName, campaignName }) =>
      `Vill du stötta mig? – ${displayName} (${campaignName})`,
    body: ({ displayName, shopUrl, campaignName, teamName }) =>
      `Hej!\n\nVi i ${teamName} har börjat sälja Roots schampo och balsam för att finansiera ${campaignName}.\n\nDet är svensktillverkade produkter av riktigt fin kvalitet – ungefär samma prisklass som man hittar på vanliga butiker. Skillnaden är att en del av pengarna går direkt till oss istället för till en stor kedja.\n\nOm du har lust att stötta oss kan du köpa via min personliga länk:\n${shopUrl}\n\nDet du beställer levereras hem till dig. Tack på förhand – det betyder massor för oss! 💚\n\nKram\n${displayName}`,
  },
  {
    id: "sms-coworkers",
    label: "SMS · Kollegor & vänner",
    channel: "SMS",
    icon: MessageCircle,
    body: ({ displayName, shopUrl }) =>
      `Hej! Säljer Roots schampo/balsam (svensktillverkat, riktigt bra) för att finansiera vår laginsamling. Köp via min länk om du har lust: ${shopUrl} /${displayName}`,
  },
];

function shareHref(channel: ShareTemplate["channel"], body: string, subject?: string): string | null {
  // mailto / sms / wa.me all take URL-encoded payloads. We return null
  // for Instagram and Facebook because neither has a reliable "share
  // pre-filled text" deep link from the browser — for those the user
  // copies and pastes, which is the expected pattern on Insta anyway.
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      // Fall back: select-all so the user can manually copy.
      window.prompt("Kopiera texten:", text);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          Färdiga texter att skicka
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Klicka på en mall för att kopiera texten – sedan klistrar du in i SMS, WhatsApp, Instagram eller e-post.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((tpl) => {
            const body = tpl.body({ displayName, shopUrl, campaignName, teamName });
            const subject = tpl.subject?.({ displayName, campaignName });
            const href = shareHref(tpl.channel, body, subject);
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
                  {body}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => copy(tpl.id, body)}
                  >
                    {copied ? (
                      <CheckCircle2 className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    {copied ? "Kopierat" : "Kopiera"}
                  </Button>
                  {href && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        Öppna {tpl.channel === "SMS" ? "SMS" : tpl.channel === "WHATSAPP" ? "WhatsApp" : "E-post"}
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
