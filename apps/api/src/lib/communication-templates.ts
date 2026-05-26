// P2.26 (audit 2026-05-26): tidigare fallback:ade alla
// inbjudningslänkar till localhost — i prod betydde det skadliga
// "Click here to join: http://localhost:3000/..." mail.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://roots.se"
    : "http://localhost:3000")
).replace(/\/$/, "");

export function getInviteTemplate(params: {
  teamName: string;
  campaignName: string;
  story: string;
  inviteToken: string;
  leaderName: string;
}): { sms: string; email: { subject: string; body: string } } {
  const inviteUrl = `${SITE_URL}/registrera/saljare/${params.inviteToken}`;

  return {
    sms: `Hej! ${params.leaderName} bjuder in dig att sälja med ${params.teamName}. Gå med här: ${inviteUrl}`,
    email: {
      subject: `Gå med i ${params.teamName} — sälj med Roots`,
      body: `Hej!

${params.leaderName} bjuder in dig att sälja Roots-produkter med ${params.teamName}.

${params.story ? `Varför vi säljer: ${params.story}` : ""}

Kampanj: ${params.campaignName}

Klicka här för att gå med och få din personliga shop:
${inviteUrl}

Det tar bara en minut att komma igång!

Med vänliga hälsningar,
${params.leaderName}`,
    },
  };
}

export function getShopShareTemplate(params: {
  sellerName: string;
  shopSlug: string;
  teamName: string;
  story: string;
}): { sms: string; email: { subject: string; body: string } } {
  const shopUrl = `${SITE_URL}/shop/${params.shopSlug}`;

  return {
    sms: `Hej! Stöd ${params.teamName} genom att köpa naturliga Roots-produkter via min shop: ${shopUrl}`,
    email: {
      subject: `Köp Roots-produkter — stöd ${params.teamName}`,
      body: `Hej!

Jag säljer naturliga hårvårdsprodukter från Roots för att stödja ${params.teamName}.

${params.story ? params.story : ""}

Besök min personliga shop här:
${shopUrl}

Schampo, balsam och body wash — helt utan sulfater, silikoner och parabener.

Tack för ditt stöd!
${params.sellerName}`,
    },
  };
}

export function getCampaignStartTemplate(params: {
  campaignName: string;
  orgName: string;
  startDate: string;
  endDate: string;
  goalValue: number;
  goalType: string;
}): { subject: string; body: string } {
  return {
    subject: `Kampanjen "${params.campaignName}" har startat!`,
    body: `Hej!

Kampanjen "${params.campaignName}" för ${params.orgName} har nu startat!

Period: ${params.startDate} – ${params.endDate}
Mål: ${params.goalType === "AMOUNT" ? `${params.goalValue.toLocaleString("sv-SE")} kr` : `${params.goalValue} paket`}

Skicka inbjudningslänken till era lagansvariga så att säljare kan ansluta och börja sälja direkt.

Lycka till!
Roots`,
  };
}

export function getMilestoneTemplate(params: {
  milestoneLabel: string;
  teamName: string;
  totalSales: string;
}): { subject: string; body: string } {
  return {
    subject: `${params.teamName} — ${params.milestoneLabel}`,
    body: `Grattis ${params.teamName}!

Ni har nått en ny milstolpe: ${params.milestoneLabel}

Total försäljning: ${params.totalSales}

Fortsätt det fantastiska arbetet!

Roots`,
  };
}
