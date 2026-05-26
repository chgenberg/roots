const BRAND_COLOR = "#1C1410";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://roots.se"
  );
}

function siteHost(): string {
  try {
    return new URL(siteUrl()).host;
  } catch {
    return "roots.se";
  }
}

function wrap(content: string): string {
  const url = siteUrl();
  const host = siteHost();
  // MASTERPLAN_01 KC7: e-postfötter måste innehålla full legal-identity
  // (bokföringslagen + e-handelslagen). Org.nr + momsreg.nr hårdkodas
  // medvetet för att matcha legal-identity-block.tsx — det är publik
  // information och får aldrig variera mellan miljöer.
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center">
  <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:0.5px">Roots</span>
</td></tr>
<tr><td style="padding:32px">${content}</td></tr>
<tr><td style="padding:16px 32px 24px;text-align:center;color:#999;font-size:12px;line-height:1.6">
  <strong style="color:#666">Roots Nordic AB</strong><br>
  Storgatan 1, 111 51 Stockholm<br>
  Org.nr 559517-3210 · Momsreg.nr SE559517321001<br>
  <a href="${url}" style="color:#999">${host}</a> · <a href="mailto:hej@roots.se" style="color:#999">hej@roots.se</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function welcomeEmail(name: string, role: string): { subject: string; html: string } {
  const roleLabel =
    role === "ASSOCIATION_ADMIN"
      ? "föreningsadministratör"
      : role === "TEAM_LEADER"
      ? "lagansvarig"
      : "säljare";

  // MASTERPLAN_01 KC3.2: /logga-in routar 404 i Next-appen. Den enda
  // login-route som finns är /login. Sellers får dessutom en
  // shortcut till sin nya butik så de inte behöver navigera manuellt.
  const loginUrl = `${siteUrl()}/login`;
  const sellerShortcut =
    role === "SELLER"
      ? `<p style="color:#444;line-height:1.6;margin:16px 0 0;font-size:13px">
           Du hittar din personliga butik direkt på
           <a href="${siteUrl()}/min-shop" style="color:${BRAND_COLOR}">min-shop</a>.
         </p>`
      : "";

  return {
    subject: `Välkommen till Roots, ${name}!`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">Välkommen, ${name}!</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Du är nu registrerad som <strong>${roleLabel}</strong> hos Roots.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Logga in på plattformen för att komma igång. Om du har frågor är du alltid välkommen att kontakta oss.
      </p>
      <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Logga in
      </a>
      ${sellerShortcut}
    `),
  };
}

export function orderConfirmationEmail(params: {
  customerName: string;
  orderId: string;
  totalOre: number;
  shopSlug: string;
  items: Array<{ name: string; qty: number; unitPriceOre: number }>;
}): { subject: string; html: string } {
  const itemRows = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:center">${item.qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:right">${((item.unitPriceOre * item.qty) / 100).toLocaleString("sv-SE")} kr</td>
        </tr>`
    )
    .join("");

  const url = siteUrl();
  // MASTERPLAN_01 KC4: visa explicit moms-rad enligt köplag. Roots
  // använder svensk standardmoms 25% på hudvård/hårvård. Beloppen
  // visas både exkl. och inkl. så att supportern ser exakt vad som
  // går till skatten.
  const totalExVatOre = Math.round(params.totalOre / 1.25);
  const vatOre = params.totalOre - totalExVatOre;
  const fmt = (ore: number) => `${(ore / 100).toLocaleString("sv-SE")} kr`;
  const orderShortId = params.orderId.slice(0, 8);

  return {
    subject: `Orderbekräftelse — ${orderShortId}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">Tack för din beställning, ${params.customerName}!</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 8px">
        Ordernummer: <strong>${orderShortId}</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
        <tr style="border-bottom:2px solid #eee">
          <th style="text-align:left;padding:8px 0;font-size:13px;color:#888">Produkt</th>
          <th style="text-align:center;padding:8px 0;font-size:13px;color:#888">Antal</th>
          <th style="text-align:right;padding:8px 0;font-size:13px;color:#888">Summa</th>
        </tr>
        ${itemRows}
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">
        <tr>
          <td style="padding:4px 0;color:#666;font-size:13px">Summa exkl. moms</td>
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmt(totalExVatOre)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#666;font-size:13px">Moms (25 %)</td>
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmt(vatOre)}</td>
        </tr>
        <tr style="border-top:1px solid #eee">
          <td style="padding:10px 0 0;color:${BRAND_COLOR};font-size:16px;font-weight:700">Totalt att betala</td>
          <td style="padding:10px 0 0;text-align:right;color:${BRAND_COLOR};font-size:16px;font-weight:700">${fmt(params.totalOre)}</td>
        </tr>
      </table>
      <a href="${url}/shop/${params.shopSlug}/order/${params.orderId}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Se orderstatus
      </a>
      <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0">
        Du har 14 dagars ångerrätt enligt distansavtalslagen, med undantag för
        öppnade hygienförpackningar. Mer info på
        <a href="${url}/villkor" style="color:#888">${url.replace(/^https?:\/\//, "")}/villkor</a>.
      </p>
    `),
  };
}

/**
 * MASTERPLAN_01 KC3.3: invite-email till en utsedd lagansvarig. Skickas
 * direkt från `association.post(/team-invites)` när admin angett en
 * `invitedEmail`. Tonen: kort förklaring av rollen → tydligt CTA.
 *
 * `inviterName` och `orgName` brukas för att personalisera "från vem"
 * — sänker risken att tas för spam. `inviteUrl` är en absolut URL
 * eftersom mail-klienter inte tolkar relativa länkar.
 */
export function teamLeaderInviteEmail(params: {
  inviterName: string;
  orgName: string;
  campaignName: string;
  teamName: string;
  inviteUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const dateFmt = params.expiresAt.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    subject: `Du är inbjuden att leda ${params.teamName} — ${params.orgName}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Du är inbjuden att leda ${params.teamName}
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        ${params.inviterName} från <strong>${params.orgName}</strong> har bjudit in
        dig att vara lagansvarig för kampanjen
        <strong>${params.campaignName}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Som lagansvarig bjuder du in säljare till ditt lag, följer
        resultaten och stöttar laget under hela kampanjen. Det tar 2
        minuter att komma igång.
      </p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Skapa konto och kom igång
      </a>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0">
        Länken är giltig till och med ${dateFmt}. Vill du inte ta rollen
        — ignorera mejlet, ingen åtgärd krävs.
      </p>
    `),
  };
}

/**
 * MASTERPLAN_01 KC3.7: bekräftelse till föreningsadmin när en TL har
 * claimat en invite. Stänger feedback-loopen så assoc-admin slipper
 * pinga lagledaren manuellt och fråga "har du registrerat dig?".
 */
export function teamLeaderClaimedEmail(params: {
  adminName: string;
  leaderName: string;
  leaderEmail: string;
  teamName: string;
  campaignName: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.leaderName} har accepterat och leder nu ${params.teamName}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Klart! ${params.teamName} har en lagansvarig.
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.adminName}, <strong>${params.leaderName}</strong>
        (${params.leaderEmail}) har accepterat din inbjudan till
        kampanjen <strong>${params.campaignName}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Nästa steg: laget kan börja bjuda in säljare. Du följer
        progressen från föreningsadminvyn.
      </p>
      <a href="${params.teamUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Visa laget
      </a>
    `),
  };
}

/**
 * MASTERPLAN_01 KC1.5: notifiera assoc-admin när en utbetalning
 * (= deras föreningsandel av kampanjförsäljningen) har markerats som
 * betald. Tonen ska vara *kvitto* — bekräftande, inte tjatigt: "klart,
 * pengarna är på väg / på ditt konto". Datumet anges som svensk
 * locale eftersom mailen alltid går till svenska föreningar.
 *
 * `paymentReference` är optionellt — det visas bara om admin angav
 * en bank-referens när de markerade payouten PAID (typiskt OCR-nr
 * eller fakturanummer).
 */
export function payoutPaidEmail(params: {
  adminName: string;
  orgName: string;
  campaignName: string;
  amountOre: number;
  paidAt: Date;
  paymentReference?: string | null;
  payoutsUrl: string;
}): { subject: string; html: string } {
  const amountSek = (params.amountOre / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const dateFmt = params.paidAt.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    subject: `Utbetalning ${amountSek} kr från Roots — ${params.campaignName}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        ${amountSek} kr är på väg till ${params.orgName}
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.adminName}, vi har idag (${dateFmt}) betalat ut er andel
        för kampanjen <strong>${params.campaignName}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;background:#f9f7f5;border-radius:8px">
        <tr>
          <td style="padding:12px 16px;color:#666;font-size:13px">Belopp</td>
          <td style="padding:12px 16px;text-align:right;font-weight:600">${amountSek} kr</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#666;font-size:13px;border-top:1px solid #eee">Datum</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #eee">${dateFmt}</td>
        </tr>
        ${
          params.paymentReference
            ? `<tr>
                 <td style="padding:12px 16px;color:#666;font-size:13px;border-top:1px solid #eee">Referens</td>
                 <td style="padding:12px 16px;text-align:right;border-top:1px solid #eee;font-family:monospace">${params.paymentReference}</td>
               </tr>`
            : ""
        }
      </table>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Pengarna är överförda till det konto ni angav vid registreringen.
        Beroende på er bank kan det ta 1–2 arbetsdagar innan beloppet
        syns på kontot.
      </p>
      <a href="${params.payoutsUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Visa alla utbetalningar
      </a>
    `),
  };
}

/**
 * MASTERPLAN_01 KC2.7: bekräftelse-email när användaren har begärt
 * radering av sitt konto. Tonen ska vara *informativ* — ingen guilt-
 * trip, men tydlig om vad som händer härnäst och att ångerlänken
 * fungerar i hela 14-dagars-fönstret. GDPR-art. 17 kräver att
 * användaren har en transparent dokumentation av request:en.
 *
 * `cancelUrl` är en magisk-token-länk så användaren INTE behöver
 * logga in för att ångra (logotypen kan ha makulerats av en hackare
 * som inte vet lösenordet — användaren ska kunna ångra ändå).
 */
export function deletionRequestEmail(params: {
  name: string;
  scheduledDeletionAt: Date;
  cancelUrl: string;
}): { subject: string; html: string } {
  const dateFmt = params.scheduledDeletionAt.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    subject: "Din begäran om att radera ditt Roots-konto",
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Vi har tagit emot din begäran
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.name}, vi har registrerat att du vill radera ditt
        Roots-konto. Vi raderar kontot <strong>${dateFmt}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Under tiden fram till dess kan du logga in som vanligt och
        ångra raderingen om du vill ha kvar kontot.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Du kan ångra direkt via knappen nedan — du behöver inte
        logga in.
      </p>
      <a href="${params.cancelUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Ångra raderingen
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        Efter att kontot raderats anonymiseras alla personliga uppgifter.
        Beställningar och fakturor sparas i anonymiserad form i 7 år som
        bokföringslagen kräver. Du kan begära ett utdrag eller en
        rättning av dina uppgifter när som helst genom att svara på
        det här e-postmeddelandet.
      </p>
    `),
  };
}

/**
 * MASTERPLAN_01 KC2.7: bekräftelse-email när användaren har ångrat
 * sin radering. Kort och vänlig — "välkommen tillbaka, allt är som
 * vanligt".
 */
export function deletionCancelledEmail(params: {
  name: string;
}): { subject: string; html: string } {
  return {
    subject: "Din kontoradering är avbruten",
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Allt är som vanligt
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.name}, vi har avbrutit raderingen av ditt
        Roots-konto. Du kan fortsätta använda kontot som vanligt.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 0">
        Om det här inte var du som ångrade — kontakta oss direkt på
        <a href="mailto:hej@roots.se" style="color:${BRAND_COLOR}">hej@roots.se</a>
        så hjälper vi dig.
      </p>
    `),
  };
}

export function milestoneEmail(params: {
  teamName: string;
  milestoneLabel: string;
  totalSales: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.teamName} — ${params.milestoneLabel}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">${params.milestoneLabel}</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Grattis <strong>${params.teamName}</strong>! Ni har nått en ny milstolpe.
      </p>
      <div style="background:#f9f7f5;border-radius:8px;padding:16px;text-align:center;margin:0 0 24px">
        <p style="margin:0;color:#888;font-size:13px">Total försäljning</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${BRAND_COLOR}">${params.totalSales}</p>
      </div>
      <p style="color:#444;line-height:1.6;margin:0">Fortsätt det fantastiska arbetet!</p>
    `),
  };
}
