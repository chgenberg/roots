import { vatOfGrossOre } from "@roots/contracts";

const BRAND_COLOR = "#1C1410";

export type EmailLocale = "sv" | "en";

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

/** Prefix path with `/en` for English; Swedish stays unprefixed. */
export function withLocalePath(path: string, locale: EmailLocale): string {
  const bare = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") {
    return bare === "/" ? "/en" : `/en${bare}`;
  }
  return bare;
}

function fmtMoney(ore: number, locale: EmailLocale): string {
  const amount = ore / 100;
  if (locale === "en") {
    return `${amount.toLocaleString("en-GB")} SEK`;
  }
  return `${amount.toLocaleString("sv-SE")} kr`;
}

function fmtDate(date: Date, locale: EmailLocale): string {
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function wrap(content: string, locale: EmailLocale = "sv"): string {
  const url = siteUrl();
  const host = siteHost();
  // MASTERPLAN_01 KC7: e-postfötter måste innehålla full legal-identity
  // (bokföringslagen + e-handelslagen). Org.nr + momsreg.nr hårdkodas
  // medvetet för att matcha legal-identity-block.tsx — det är publik
  // information och får aldrig variera mellan miljöer.
  return `<!DOCTYPE html>
<html lang="${locale}">
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
  <strong style="color:#666">Ourroots AB</strong><br>
  Hallängsvägen 8, 439 55 Åsa<br>
  ${
    locale === "en"
      ? "Company no. 559355-7126"
      : "Org.nr 559355-7126"
  }<br>
  <a href="${url}" style="color:#999">${host}</a> · <a href="mailto:info@roots.nu" style="color:#999">info@roots.nu</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function welcomeEmail(
  name: string,
  role: string,
  locale: EmailLocale = "sv"
): { subject: string; html: string } {
  const loginUrl = `${siteUrl()}${withLocalePath("/login", locale)}`;

  if (locale === "en") {
    const roleLabel =
      role === "ASSOCIATION_ADMIN"
        ? "club administrator"
        : role === "TEAM_LEADER"
          ? "team leader"
          : "seller";
    const sellerShortcut =
      role === "SELLER"
        ? `<p style="color:#444;line-height:1.6;margin:16px 0 0;font-size:13px">
             You can open your personal shop directly at
             <a href="${siteUrl()}${withLocalePath("/min-shop", locale)}" style="color:${BRAND_COLOR}">My shop</a>.
           </p>`
        : "";
    return {
      subject: `Welcome to Roots, ${name}!`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">Welcome, ${name}!</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        You are now registered as a <strong>${roleLabel}</strong> with Roots.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Sign in to the platform to get started. If you have any questions, you are always welcome to contact us.
      </p>
      <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Sign in
      </a>
      ${sellerShortcut}
    `,
        locale
      ),
    };
  }

  const roleLabel =
    role === "ASSOCIATION_ADMIN"
      ? "föreningsadministratör"
      : role === "TEAM_LEADER"
        ? "lagansvarig"
        : "säljare";

  // MASTERPLAN_01 KC3.2: /logga-in routar 404 i Next-appen. Den enda
  // login-route som finns är /login. Sellers får dessutom en
  // shortcut till sin nya butik så de inte behöver navigera manuellt.
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
  /**
   * P1.5 (audit 2026-05-26): signerad token som låser order-status-
   * länken till just den här kunden. Utan token är endpointen 401:ad.
   */
  viewToken: string;
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";
  const orderShortId = params.orderId.slice(0, 8);
  const vatOre = vatOfGrossOre(params.totalOre);
  const totalExVatOre = params.totalOre - vatOre;
  const url = siteUrl();
  const orderPath = withLocalePath(
    `/shop/${params.shopSlug}/order/${params.orderId}`,
    locale
  );
  const orderUrl = `${url}${orderPath}?t=${encodeURIComponent(params.viewToken)}`;
  const termsPath = withLocalePath("/villkor", locale);

  if (locale === "en") {
    const itemRows = params.items
      .map(
        (item) =>
          `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:center">${item.qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:right">${fmtMoney(item.unitPriceOre * item.qty, locale)}</td>
        </tr>`
      )
      .join("");

    return {
      subject: `Order confirmation — ${orderShortId}`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">Thank you for your order, ${params.customerName}!</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 8px">
        Order number: <strong>${orderShortId}</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
        <tr style="border-bottom:2px solid #eee">
          <th style="text-align:left;padding:8px 0;font-size:13px;color:#888">Product</th>
          <th style="text-align:center;padding:8px 0;font-size:13px;color:#888">Qty</th>
          <th style="text-align:right;padding:8px 0;font-size:13px;color:#888">Total</th>
        </tr>
        ${itemRows}
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">
        <tr>
          <td style="padding:4px 0;color:#666;font-size:13px">Subtotal excl. VAT</td>
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmtMoney(totalExVatOre, locale)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#666;font-size:13px">VAT (25%)</td>
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmtMoney(vatOre, locale)}</td>
        </tr>
        <tr style="border-top:1px solid #eee">
          <td style="padding:10px 0 0;color:${BRAND_COLOR};font-size:16px;font-weight:700">Total to pay</td>
          <td style="padding:10px 0 0;text-align:right;color:${BRAND_COLOR};font-size:16px;font-weight:700">${fmtMoney(params.totalOre, locale)}</td>
        </tr>
      </table>
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View order status
      </a>
      <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0">
        You have a 14-day right of withdrawal under the Distance Contracts Act,
        with an exception for opened hygiene packaging. More information at
        <a href="${url}${termsPath}" style="color:#888">${url.replace(/^https?:\/\//, "")}${termsPath}</a>.
      </p>
    `,
        locale
      ),
    };
  }

  // MASTERPLAN_01 KC4: visa explicit moms-rad enligt köplag. Roots
  // använder svensk standardmoms 25% på hudvård/hårvård. Beloppen
  // visas både exkl. och inkl. så att supportern ser exakt vad som
  // går till skatten.
  const itemRows = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:center">${item.qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;font-size:14px;text-align:right">${fmtMoney(item.unitPriceOre * item.qty, locale)}</td>
        </tr>`
    )
    .join("");

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
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmtMoney(totalExVatOre, locale)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#666;font-size:13px">Moms (25 %)</td>
          <td style="padding:4px 0;text-align:right;color:#666;font-size:13px">${fmtMoney(vatOre, locale)}</td>
        </tr>
        <tr style="border-top:1px solid #eee">
          <td style="padding:10px 0 0;color:${BRAND_COLOR};font-size:16px;font-weight:700">Totalt att betala</td>
          <td style="padding:10px 0 0;text-align:right;color:${BRAND_COLOR};font-size:16px;font-weight:700">${fmtMoney(params.totalOre, locale)}</td>
        </tr>
      </table>
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Se orderstatus
      </a>
      <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0">
        Du har 14 dagars ångerrätt enligt distansavtalslagen, med undantag för
        öppnade hygienförpackningar. Mer info på
        <a href="${url}${termsPath}" style="color:#888">${url.replace(/^https?:\/\//, "")}${termsPath}</a>.
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
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";
  const dateFmt = fmtDate(params.expiresAt, locale);

  if (locale === "en") {
    return {
      subject: `You are invited to lead ${params.teamName} — ${params.orgName}`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        You are invited to lead ${params.teamName}
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        ${params.inviterName} from <strong>${params.orgName}</strong> has invited
        you to be team leader for the campaign
        <strong>${params.campaignName}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        As team leader you invite sellers to your team, track results and
        support the team throughout the campaign. It takes about two minutes
        to get started.
      </p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Create account and get started
      </a>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0">
        The link is valid until ${dateFmt}. If you do not want the role,
        ignore this email — no action is required.
      </p>
    `,
        locale
      ),
    };
  }

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
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: `${params.leaderName} has accepted and now leads ${params.teamName}`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Done! ${params.teamName} has a team leader.
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.adminName}, <strong>${params.leaderName}</strong>
        (${params.leaderEmail}) has accepted your invitation for the
        campaign <strong>${params.campaignName}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        Next step: the team can start inviting sellers. You can follow
        progress from the club admin view.
      </p>
      <a href="${params.teamUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View team
      </a>
    `,
        locale
      ),
    };
  }

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
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";
  const amountSek = (params.amountOre / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
  const amountLabel = locale === "en" ? `${amountSek} SEK` : `${amountSek} kr`;
  const dateFmt = fmtDate(params.paidAt, locale);

  if (locale === "en") {
    return {
      subject: `Payout of ${amountLabel} from Roots — ${params.campaignName}`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        ${amountLabel} is on its way to ${params.orgName}
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.adminName}, today (${dateFmt}) we paid out your share
        for the campaign <strong>${params.campaignName}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;background:#f9f7f5;border-radius:8px">
        <tr>
          <td style="padding:12px 16px;color:#666;font-size:13px">Amount</td>
          <td style="padding:12px 16px;text-align:right;font-weight:600">${amountLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#666;font-size:13px;border-top:1px solid #eee">Date</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #eee">${dateFmt}</td>
        </tr>
        ${
          params.paymentReference
            ? `<tr>
                 <td style="padding:12px 16px;color:#666;font-size:13px;border-top:1px solid #eee">Reference</td>
                 <td style="padding:12px 16px;text-align:right;border-top:1px solid #eee;font-family:monospace">${params.paymentReference}</td>
               </tr>`
            : ""
        }
      </table>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        The funds have been transferred to the account you provided at
        registration. Depending on your bank, it may take 1–2 working days
        before the amount appears.
      </p>
      <a href="${params.payoutsUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View all payouts
      </a>
    `,
        locale
      ),
    };
  }

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
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";
  const dateFmt = fmtDate(params.scheduledDeletionAt, locale);

  if (locale === "en") {
    return {
      subject: "Your request to delete your Roots account",
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        We have received your request
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.name}, we have registered that you want to delete your
        Roots account. We will delete the account on <strong>${dateFmt}</strong>.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Until then you can sign in as usual and cancel the deletion if you
        want to keep the account.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 24px">
        You can cancel directly via the button below — you do not need to
        sign in.
      </p>
      <a href="${params.cancelUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Cancel deletion
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        After the account is deleted, all personal data is anonymised.
        Orders and invoices are retained in anonymised form for 7 years as
        required by the Swedish Bookkeeping Act. You may request an extract
        or a correction of your data at any time by replying to this email.
      </p>
    `,
        locale
      ),
    };
  }

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
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: "Your account deletion has been cancelled",
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Everything is as usual
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.name}, we have cancelled the deletion of your
        Roots account. You can continue using the account as usual.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 0">
        If this was not you — contact us straight away at
        <a href="mailto:info@roots.nu" style="color:${BRAND_COLOR}">info@roots.nu</a>
        and we will help you.
      </p>
    `,
        locale
      ),
    };
  }

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
        <a href="mailto:info@roots.nu" style="color:${BRAND_COLOR}">info@roots.nu</a>
        så hjälper vi dig.
      </p>
    `),
  };
}

/**
 * Inbjudan till en klubbmedlem. Kontot skapas med en icke-inloggningsbar
 * sentinel-hash; det här mejlet är enda vägen in. Utan det fanns kontot men
 * kunde aldrig användas.
 */
export function memberInviteEmail(params: {
  name: string;
  orgName: string;
  inviteUrl: string;
  expiresInDays: number;
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: `You are invited to ${params.orgName} on Roots`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Welcome to Roots
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.name}, ${params.orgName} has invited you to their
        Roots portal. Choose a password to get started.
      </p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Choose password
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        The link works for ${params.expiresInDays} days. If it has expired you can
        use "Forgot password?" on the sign-in page, or ask the person who
        invited you to send a new one.
      </p>
    `,
        locale
      ),
    };
  }

  return {
    subject: `Du är inbjuden till ${params.orgName} på Roots`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Välkommen till Roots
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.name}, ${params.orgName} har bjudit in dig till sin
        Roots-portal. Välj ett lösenord för att komma igång.
      </p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Välj lösenord
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        Länken fungerar i ${params.expiresInDays} dagar. Har den gått ut kan du
        använda "Glömt lösenordet?" på inloggningssidan, eller be den som bjöd
        in dig att skicka en ny.
      </p>
    `),
  };
}

/**
 * Skickas till vårdnadshavaren när en säljare under 18 registrerat sig med
 * deras samtycke. Poängen är dubbel: föräldern får veta vad som händer, och
 * vi får en spårbar kanal om samtycket inte var äkta.
 */
export function guardianConsentNoticeEmail(params: {
  guardianName: string;
  sellerName: string;
  teamName: string;
  associationName: string;
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: `${params.sellerName} has registered as a seller with Roots`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Consent has been given in your name
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.guardianName}, <strong>${params.sellerName}</strong> has
        registered as a seller in ${params.teamName}
        (${params.associationName}) and stated that you, as their guardian,
        approve this.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Sales take place via a personal web shop with Roots skin and hair
        care products. We handle payment and delivery; the team receives its
        share of the sales.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        If this was not you — or if you change your mind — reply to this
        email or write to
        <a href="mailto:info@roots.nu" style="color:${BRAND_COLOR}">info@roots.nu</a>.
        We will close the shop and delete the data.
      </p>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        You may at any time request an extract of the data we hold about
        your child, or that it be corrected or deleted.
      </p>
    `,
        locale
      ),
    };
  }

  return {
    subject: `${params.sellerName} har registrerat sig som säljare hos Roots`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Ett samtycke har lämnats i ditt namn
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.guardianName}, <strong>${params.sellerName}</strong> har
        registrerat sig som säljare i ${params.teamName}
        (${params.associationName}) och angett att du som vårdnadshavare
        godkänner det.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Försäljningen sker via en personlig webbutik med Roots hudvårds- och
        hårvårdsprodukter. Vi hanterar betalning och leverans; laget får sin
        andel av försäljningen.
      </p>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Var det inte du som godkände — eller ändrar du dig — svara på det här
        mejlet eller skriv till
        <a href="mailto:info@roots.nu" style="color:${BRAND_COLOR}">info@roots.nu</a>.
        Vi stänger butiken och raderar uppgifterna.
      </p>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        Du kan när som helst begära ett utdrag av vilka uppgifter vi har om
        ditt barn, eller att de rättas eller raderas.
      </p>
    `),
  };
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: "Reset your Roots password",
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Reset your password
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hello ${params.name}, someone has requested a password reset for
        your Roots account. Click the button below to choose a new one.
      </p>
      <a href="${params.resetUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Choose new password
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        The link works for ${params.expiresInMinutes} minutes and only once.
        If you did not request it, you do not need to do anything — your
        current password remains valid.
      </p>
    `,
        locale
      ),
    };
  }

  return {
    subject: "Återställ ditt lösenord hos Roots",
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">
        Återställ ditt lösenord
      </h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Hej ${params.name}, någon har begärt en återställning av lösenordet
        för ditt Roots-konto. Klicka på knappen nedan för att välja ett nytt.
      </p>
      <a href="${params.resetUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Välj nytt lösenord
      </a>
      <p style="color:#999;line-height:1.6;margin:24px 0 0;font-size:12px">
        Länken fungerar i ${params.expiresInMinutes} minuter och bara en gång.
        Var det inte du som begärde den behöver du inte göra något — ditt
        nuvarande lösenord fortsätter att gälla.
      </p>
    `),
  };
}

export function milestoneEmail(params: {
  teamName: string;
  milestoneLabel: string;
  totalSales: string;
  locale?: EmailLocale;
}): { subject: string; html: string } {
  const locale = params.locale ?? "sv";

  if (locale === "en") {
    return {
      subject: `${params.teamName} — ${params.milestoneLabel}`,
      html: wrap(
        `
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">${params.milestoneLabel}</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px">
        Congratulations <strong>${params.teamName}</strong>! You have reached a new milestone.
      </p>
      <div style="background:#f9f7f5;border-radius:8px;padding:16px;text-align:center;margin:0 0 24px">
        <p style="margin:0;color:#888;font-size:13px">Total sales</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${BRAND_COLOR}">${params.totalSales}</p>
      </div>
      <p style="color:#444;line-height:1.6;margin:0">Keep up the brilliant work!</p>
    `,
        locale
      ),
    };
  }

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
