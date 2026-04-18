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
  Roots Nordic AB · <a href="${url}" style="color:#999">${host}</a><br>
  Frågor? <a href="mailto:hej@roots.se" style="color:#999">hej@roots.se</a>
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
      <a href="${siteUrl()}/logga-in" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Logga in
      </a>
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

  return {
    subject: `Orderbekräftelse — ${params.orderId.slice(0, 8)}`,
    html: wrap(`
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px">Tack för din beställning, ${params.customerName}!</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 8px">
        Ordernummer: <strong>${params.orderId.slice(0, 8)}</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
        <tr style="border-bottom:2px solid #eee">
          <th style="text-align:left;padding:8px 0;font-size:13px;color:#888">Produkt</th>
          <th style="text-align:center;padding:8px 0;font-size:13px;color:#888">Antal</th>
          <th style="text-align:right;padding:8px 0;font-size:13px;color:#888">Summa</th>
        </tr>
        ${itemRows}
      </table>
      <p style="text-align:right;font-size:18px;font-weight:700;color:${BRAND_COLOR};margin:16px 0">
        Totalt: ${(params.totalOre / 100).toLocaleString("sv-SE")} kr
      </p>
      <a href="${url}/shop/${params.shopSlug}/order/${params.orderId}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Se orderstatus
      </a>
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
