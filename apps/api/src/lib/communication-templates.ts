// P2.26 (audit 2026-05-26): tidigare fallback:ade alla
// inbjudningslänkar till localhost — i prod betydde det skadliga
// "Click here to join: http://localhost:3000/..." mail.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://roots.se"
    : "http://localhost:3000")
).replace(/\/$/, "");

export type CommLocale = "sv" | "en";

function withLocalePath(path: string, locale: CommLocale): string {
  const bare = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") {
    return bare === "/" ? "/en" : `/en${bare}`;
  }
  return bare;
}

export function getInviteTemplate(params: {
  teamName: string;
  campaignName: string;
  story: string;
  inviteToken: string;
  leaderName: string;
  locale?: CommLocale;
}): { sms: string; email: { subject: string; body: string } } {
  const locale = params.locale ?? "sv";
  const inviteUrl = `${SITE_URL}${withLocalePath(`/registrera/saljare/${params.inviteToken}`, locale)}`;

  if (locale === "en") {
    return {
      sms: `Hi! ${params.leaderName} invites you to sell with ${params.teamName}. Join here: ${inviteUrl}`,
      email: {
        subject: `Join ${params.teamName} — sell with Roots`,
        body: `Hi!

${params.leaderName} invites you to sell Roots products with ${params.teamName}.

${params.story ? `Why we sell: ${params.story}` : ""}

Campaign: ${params.campaignName}

Click here to join and get your personal shop:
${inviteUrl}

It only takes a minute to get started!

Kind regards,
${params.leaderName}`,
      },
    };
  }

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
  locale?: CommLocale;
}): { sms: string; email: { subject: string; body: string } } {
  const locale = params.locale ?? "sv";
  const shopUrl = `${SITE_URL}${withLocalePath(`/shop/${params.shopSlug}`, locale)}`;

  if (locale === "en") {
    return {
      sms: `Hi! Support ${params.teamName} by buying natural Roots products via my shop: ${shopUrl}`,
      email: {
        subject: `Buy Roots products — support ${params.teamName}`,
        body: `Hi!

I am selling natural hair care products from Roots to support ${params.teamName}.

${params.story ? params.story : ""}

Visit my personal shop here:
${shopUrl}

Shampoo, conditioner and body wash — free from sulphates, silicones and parabens.

Thank you for your support!
${params.sellerName}`,
      },
    };
  }

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
  locale?: CommLocale;
}): { subject: string; body: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    const goalLine =
      params.goalType === "AMOUNT"
        ? `${params.goalValue.toLocaleString("en-GB")} SEK`
        : `${params.goalValue} packs`;

    return {
      subject: `The campaign "${params.campaignName}" has started!`,
      body: `Hi!

The campaign "${params.campaignName}" for ${params.orgName} has now started!

Period: ${params.startDate} – ${params.endDate}
Goal: ${goalLine}

Send the invitation link to your team leaders so sellers can join and start selling straight away.

Good luck!
Roots`,
    };
  }

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
  locale?: CommLocale;
}): { subject: string; body: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: `${params.teamName} — ${params.milestoneLabel}`,
      body: `Congratulations ${params.teamName}!

You have reached a new milestone: ${params.milestoneLabel}

Total sales: ${params.totalSales}

Keep up the brilliant work!

Roots`,
    };
  }

  return {
    subject: `${params.teamName} — ${params.milestoneLabel}`,
    body: `Grattis ${params.teamName}!

Ni har nått en ny milstolpe: ${params.milestoneLabel}

Total försäljning: ${params.totalSales}

Fortsätt det fantastiska arbetet!

Roots`,
  };
}
