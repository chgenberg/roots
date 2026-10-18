import type { Locale } from "../config";

type DemoCopy = {
  metaTitle: string;
  metaDescription: string;
  metaTitleFor: string;
  eyebrow: string;
  title: string;
  lead: string;
  clubLabel: string;
  clubPlaceholder: string;
  websiteLabel: string;
  websitePlaceholder: string;
  websiteHint: string;
  websiteLoading: string;
  websiteFound: string;
  websiteNoLogo: string;
  websiteLogoOnly: string;
  websiteError: string;
  websiteLimited: string;
  websiteClear: string;
  teamLabel: string;
  teamPlaceholder: string;
  goalLabel: string;
  previewFallbackClub: string;
  shopSupport: string;
  shopShareLine: string;
  shopSellerLine: string;
  shopRaised: string;
  shopMeterNote: string;
  shopGoal: string;
  shopBuy: string;
  qrTitle: string;
  qrBody: string;
  shareTitle: string;
  shareBody: string;
  shareButton: string;
  shareText: string;
  copyLink: string;
  copied: string;
  whatsapp: string;
  email: string;
  emailSubject: string;
  realTitle: string;
  realBody: string;
  realButton: string;
  sharedBanner: string;
  note: string;
  teaserTitle: string;
  teaserBody: string;
  teaserButton: string;
  welcomeCalc: string;
  welcomeCalcClub: string;
  welcomeDemo: string;
  welcomeCalcCta: string;
  welcomeDemoCta: string;
  welcomeDismiss: string;
  calcShareButton: string;
  calcShareText: string;
  calcShareTextNoClub: string;
  calcDownloadImage: string;
  calcSharedBanner: string;
  ogDemoTitle: string;
  ogDemoBody: string;
  ogCalcLead: string;
  ogCalcLeadNoClub: string;
  ogCalcBody: string;
};

export const demo: Record<Locale, DemoCopy> = {
  sv: {
    metaTitle: "Prova själv: er demo-shop på 10 sekunder",
    metaDescription:
      "Skriv in föreningens namn och se hur er egen Roots-shop ser ut, med QR-kod och mål. Skicka den vidare till styrelsen.",
    metaTitleFor: "{clubGen} demo-shop",
    eyebrow: "Prova själv",
    title: "Er demo-shop på 10 sekunder",
    lead: "Skriv in föreningens namn så ser ni direkt hur er shop ser ut. Skicka den vidare till styrelsen eller lagets föräldrar.",
    clubLabel: "Föreningens namn",
    clubPlaceholder: "t.ex. Kullaviks IF",
    websiteLabel: "Er webbplats (valfritt)",
    websitePlaceholder: "t.ex. brunfloik.se eller laget.se/BrunfloIK",
    websiteHint: "Vi hämtar er logga och era färger till förhandsvisningen. Inget sparas.",
    websiteLoading: "Hämtar er logga och era färger …",
    websiteFound: "Klart. Logga och färger från {host}.",
    websiteNoLogo: "Vi hittade ingen logga på {host}. Shopen visar era initialer.",
    websiteLogoOnly: "Klart. Loggan kommer från {host}.",
    websiteError: "Vi kunde inte läsa sajten. Kontrollera adressen och prova igen.",
    websiteLimited: "Många försök på kort tid. Vänta en stund och prova igen.",
    websiteClear: "Ta bort",
    teamLabel: "Lag eller klass (valfritt)",
    teamPlaceholder: "t.ex. F13 eller klass 9B",
    goalLabel: "Vad vill ni samla in?",
    previewFallbackClub: "Er förening",
    shopSupport: "Stöd {club}",
    shopShareLine: "35 % av varje köp går direkt till oss.",
    shopSellerLine: "Alva säljer för {team}",
    shopRaised: "{raised} insamlat",
    shopMeterNote: "Varje köp syns i mätaren direkt.",
    shopGoal: "Mål {goal}",
    shopBuy: "Köp",
    qrTitle: "Skanna och se den i mobilen",
    qrBody: "Så här får varje säljare en egen QR-kod att visa upp.",
    shareTitle: "Skicka till styrelsen",
    shareBody: "Länken öppnar exakt den här demo-shopen, med ert namn.",
    shareButton: "Skicka till styrelsen",
    shareText: "Kolla, så här kan {clubGen} egen Roots-shop se ut. 35 % av varje köp går till oss:",
    copyLink: "Kopiera länk",
    copied: "Länken är kopierad",
    whatsapp: "WhatsApp",
    email: "E-post",
    emailSubject: "{clubGen} demo-shop hos Roots",
    realTitle: "Gör det på riktigt",
    realBody: "Anmäl intresse så hör vi av oss och sätter upp er riktiga shop.",
    realButton: "Sälj med oss",
    sharedBanner: "Någon har skickat {clubGen} demo-shop till dig. Ändra gärna och skicka vidare.",
    note: "Det här är en förhandsvisning. Inget sparas och inget skickas förrän ni anmäler intresse.",
    teaserTitle: "Prova själv",
    teaserBody: "Skriv in er förening och se er egen shop, med QR-kod och mål, på tio sekunder.",
    teaserButton: "Visa vår shop",
    welcomeCalc: "Välkommen tillbaka. Er kalkyl landade på {amount}.",
    welcomeCalcClub: "Välkommen tillbaka. {clubGen} kalkyl landade på {amount}.",
    welcomeDemo: "Välkommen tillbaka. {clubGen} demo-shop väntar på er.",
    welcomeCalcCta: "Fortsätt",
    welcomeDemoCta: "Öppna shopen",
    welcomeDismiss: "Stäng",
    calcShareButton: "Skicka till lagets föräldragrupp",
    calcShareText: "{club} kan tjäna {amount} med Roots. 35 % av varje köp går till oss. Se kalkylen:",
    calcShareTextNoClub: "Vi kan tjäna {amount} med Roots. 35 % av varje köp går till oss. Se kalkylen:",
    calcDownloadImage: "Ladda ner som bild",
    calcSharedBanner: "Någon har skickat den här kalkylen till dig. Dra i reglagen och räkna på ert eget lag.",
    ogDemoTitle: "{clubGen} demo-shop",
    ogDemoBody: "35 % av varje köp går till föreningen.",
    ogCalcLead: "{club} kan tjäna",
    ogCalcLeadNoClub: "Vår förening kan tjäna",
    ogCalcBody: "med Roots. 35 % av varje köp går till föreningen.",
  },
  en: {
    metaTitle: "Try it: your demo shop in 10 seconds",
    metaDescription:
      "Type in your club's name and see your own Roots shop, with QR code and goal. Send it on to the board.",
    metaTitleFor: "{clubGen} demo shop",
    eyebrow: "Try it yourself",
    title: "Your demo shop in 10 seconds",
    lead: "Type in your club's name and see your shop right away. Send it to the board or the team's parents.",
    clubLabel: "Club name",
    clubPlaceholder: "e.g. Kullavik IF",
    websiteLabel: "Your website (optional)",
    websitePlaceholder: "e.g. brunfloik.se or laget.se/BrunfloIK",
    websiteHint: "We fetch your logo and colours for the preview. Nothing is saved.",
    websiteLoading: "Fetching your logo and colours …",
    websiteFound: "Done. Logo and colours from {host}.",
    websiteNoLogo: "We found no logo on {host}. The shop shows your initials.",
    websiteLogoOnly: "Done. The logo comes from {host}.",
    websiteError: "We couldn't read the site. Check the address and try again.",
    websiteLimited: "Lots of attempts in a short time. Wait a moment and try again.",
    websiteClear: "Remove",
    teamLabel: "Team or class (optional)",
    teamPlaceholder: "e.g. U13 girls or class 9B",
    goalLabel: "How much do you want to raise?",
    previewFallbackClub: "Your club",
    shopSupport: "Support {club}",
    shopShareLine: "35% of every purchase goes straight to us.",
    shopSellerLine: "Alva is selling for {team}",
    shopRaised: "{raised} raised",
    shopMeterNote: "Every purchase shows up in the meter right away.",
    shopGoal: "Goal {goal}",
    shopBuy: "Buy",
    qrTitle: "Scan it and see it on your phone",
    qrBody: "This is how every seller gets their own QR code to show.",
    shareTitle: "Send it to the board",
    shareBody: "The link opens exactly this demo shop, with your name.",
    shareButton: "Send to the board",
    shareText: "Look, this is what {clubGen} own Roots shop could look like. 35% of every purchase goes to us:",
    copyLink: "Copy link",
    copied: "Link copied",
    whatsapp: "WhatsApp",
    email: "Email",
    emailSubject: "{clubGen} demo shop at Roots",
    realTitle: "Make it real",
    realBody: "Register your interest and we will set up your real shop.",
    realButton: "Sell with us",
    sharedBanner: "Someone sent you {clubGen} demo shop. Feel free to change it and pass it on.",
    note: "This is a preview. Nothing is saved or sent until you register your interest.",
    teaserTitle: "Try it yourself",
    teaserBody: "Type in your club and see your own shop, with QR code and goal, in ten seconds.",
    teaserButton: "Show our shop",
    welcomeCalc: "Welcome back. Your estimate came to {amount}.",
    welcomeCalcClub: "Welcome back. {clubGen} estimate came to {amount}.",
    welcomeDemo: "Welcome back. {clubGen} demo shop is waiting for you.",
    welcomeCalcCta: "Continue",
    welcomeDemoCta: "Open the shop",
    welcomeDismiss: "Close",
    calcShareButton: "Send to the team's parent group",
    calcShareText: "{club} could earn {amount} with Roots. 35% of every purchase goes to us. See the estimate:",
    calcShareTextNoClub: "We could earn {amount} with Roots. 35% of every purchase goes to us. See the estimate:",
    calcDownloadImage: "Download as image",
    calcSharedBanner: "Someone sent you this estimate. Move the sliders and work out your own team.",
    ogDemoTitle: "{clubGen} demo shop",
    ogDemoBody: "35% of every purchase goes to the club.",
    ogCalcLead: "{club} could earn",
    ogCalcLeadNoClub: "Our club could earn",
    ogCalcBody: "with Roots. 35% of every purchase goes to the club.",
  },
};

/** Genitiv: "Kullaviks IF" → "Kullaviks IF:s", "Brunflo IK" → "Brunflo IK:s", "Roots" → "Roots". */
export function clubGenitive(club: string, locale: Locale): string {
  const name = club.trim();
  if (locale === "en") return /s$/i.test(name) ? `${name}'` : `${name}'s`;
  if (/[sxz]$/i.test(name)) return name;
  // Förkortningar (IF, IK, RF, BK …) får kolon i svensk genitiv.
  if (/(^|\s)[A-ZÅÄÖ]{2,4}$/.test(name)) return `${name}:s`;
  return `${name}s`;
}

export const DEMO_GOALS_KR = [10_000, 25_000, 50_000, 100_000] as const;
export const DEMO_DEFAULT_GOAL_KR = 25_000;
/** Andel av målet som demo-mätaren visar som redan insamlat. */
export const DEMO_RAISED_SHARE = 0.64;
