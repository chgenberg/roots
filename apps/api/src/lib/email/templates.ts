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
