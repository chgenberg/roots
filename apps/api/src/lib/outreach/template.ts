/**
 * Mallen för lead-mejlen och räkneexemplet i dem.
 *
 * Fälten skrivs med hakparentes, precis som i Niclas utkast, så att texten
 * kan klistras in som den är. Saknas något som räkneexemplet behöver
 * (antal medlemmar) går mejlet inte att godkänna — vi skickar aldrig ett
 * mejl med en tom siffra i.
 */

import { LOCKED_MARGIN_PERCENT } from "@roots/contracts";

export const DEFAULT_SUBJECT_TEMPLATE = "Ett förslag till [Föreningsnamn] från Roots";

export const DEFAULT_BODY_TEMPLATE = `Hej [Förnamn]!

[Avsändare] här! Vi har tidigare haft kontakt genom mitt arbete på Folkspel. Nu jobbar jag på Roots, och jag vill gärna berätta om en ny möjlighet för [Föreningsnamn] att stärka föreningskassan.

Roots erbjuder premiumprodukter inom hår- och kroppsvård, med schampo, balsam och body wash som människor använder i vardagen. Vi kallar det Premium för föreningslivet.

Bakom Roots finns människor med lång erfarenhet av föreningsförsäljning och gedigen kunskap inom hår- och hudvård. Vi vet hur mycket ideellt arbete som ligger bakom en fungerande förening. Därför är enkelhet vår utgångspunkt – Roots ska vara den hjälpande handen.

Vad innebär det för er?

• 35 % till föreningen vid er försäljningsaktivitet. En tydlig förtjänst som gör skillnad för föreningen, lagen och verksamheten.
• Produkter som tar slut – och köps igen. När kunderna återkommer och handlar får föreningen fortsatt ersättning. Försäljningen kan alltså ge intäkter även efter den första aktiviteten.
• Premiumprodukter för hela familjen. Användbara vardagsprodukter, utvecklade med kunskap och omsorg.
• En egen digital säljsida. Medlemmarna delar sina personliga säljlänkar och kunderna beställer och betalar digitalt.
• Smidig leverans. Samlad leverans till föreningen eller laget, med möjlighet för kunderna att välja hemleverans.
• Personligt stöd hela vägen. Jag hjälper er att planera och komma igång, och finns med under försäljningen.

Vad skulle [Föreningsnamn] kunna tjäna?

För att göra det konkret har vi räknat på ett exempel för just er:

[Antal säljande medlemmar] medlemmar × [Försäljning per medlem] kr = [Total försäljning] kr i försäljning

Med 35 % till föreningen innebär det [Framräknad behållning] kr till [Föreningsnamn] under en försäljningsperiod.

Det är ett räkneexempel utifrån [kort beskrivning av antagandena]. Intäkter från framtida återköp kan tillkomma.

Så här skulle er egen säljsida kunna se ut

Vi har också tagit fram ett förslag med ert föreningsnamn och er logotyp, så att ni kan få en känsla för upplägget:

👉 [Se förslaget för Föreningsnamn]

Jag tar gärna ett kort möte och visar hur det fungerar och hur vi skulle kunna lägga upp en försäljning som passar er.

Har du 30 minuter nästa vecka? Jag kommer gärna förbi eller tar ett digitalt möte – det som passar er bäst.

Vänliga hälsningar,
[Avsändare]
[Titel] | Roots
[Telefonnummer]
[E-postadress]
https://roots.nu`;

export const TEMPLATE_FIELDS = [
  "[Förnamn]",
  "[Föreningsnamn]",
  "[Antal säljande medlemmar]",
  "[Försäljning per medlem]",
  "[Total försäljning]",
  "[Framräknad behållning]",
  "[kort beskrivning av antagandena]",
  "[Se förslaget för Föreningsnamn]",
  "[Avsändare]",
  "[Titel]",
  "[Telefonnummer]",
  "[E-postadress]",
] as const;

const LINK_FIELD = "[Se förslaget för Föreningsnamn]";

export interface TemplateSender {
  name: string;
  title: string;
  phone: string | null;
  email: string;
}

export interface TemplateLead {
  orgName: string;
  contactName: string | null;
  memberCount: number | null;
  packagesPerMember: number;
  packagePriceKr: number;
}

export interface LeadCalculation {
  perMemberKr: number;
  totalKr: number;
  associationKr: number;
}

export function calculateLead(lead: Pick<TemplateLead, "memberCount" | "packagesPerMember" | "packagePriceKr">): LeadCalculation | null {
  if (!lead.memberCount || lead.memberCount <= 0) return null;
  const perMemberKr = lead.packagesPerMember * lead.packagePriceKr;
  const totalKr = lead.memberCount * perMemberKr;
  return {
    perMemberKr,
    totalKr,
    associationKr: Math.round((totalKr * LOCKED_MARGIN_PERCENT) / 100),
  };
}

export function firstName(contactName: string | null): string | null {
  const first = contactName?.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : null;
}

const kr = (n: number) => n.toLocaleString("sv-SE").replace(/\u00a0/g, " ");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
  /** Det som saknas för att mejlet ska kunna skickas. Tom = komplett. */
  missing: string[];
}

const FOOTER_TEXT =
  "Vill du inte få fler mejl från mig? Svara bara ”nej tack” så hör jag inte av mig igen. Så hanterar Roots personuppgifter: https://roots.nu/integritet";

export function renderLeadMail(opts: {
  subjectTemplate: string;
  bodyTemplate: string;
  sender: TemplateSender;
  lead: TemplateLead;
  proposalUrl: string;
}): RenderedMail {
  const { sender, lead } = opts;
  const calc = calculateLead(lead);
  const name = firstName(lead.contactName);
  const missing: string[] = [];
  if (!lead.orgName.trim()) missing.push("Föreningsnamn saknas");
  const usesCalc = /\[(Antal säljande medlemmar|Total försäljning|Framräknad behållning)\]/.test(
    opts.bodyTemplate
  );
  if (usesCalc && !calc) missing.push("Antal medlemmar saknas");

  const values: Record<string, string> = {
    "[Föreningsnamn]": lead.orgName.trim(),
    "[Antal säljande medlemmar]": calc ? kr(lead.memberCount!) : "[Antal säljande medlemmar]",
    "[Försäljning per medlem]": kr(lead.packagesPerMember * lead.packagePriceKr),
    "[Total försäljning]": calc ? kr(calc.totalKr) : "[Total försäljning]",
    "[Framräknad behållning]": calc ? kr(calc.associationKr) : "[Framräknad behållning]",
    "[kort beskrivning av antagandena]": `att varje medlem säljer ${lead.packagesPerMember} paket à ${kr(lead.packagePriceKr)} kr`,
    "[Avsändare]": sender.name,
    "[Titel]": sender.title,
    "[E-postadress]": sender.email,
  };

  function fill(template: string): string {
    let out = template;
    out = name
      ? out.replaceAll("[Förnamn]", name)
      : out.replace(/Hej \[Förnamn\]!/g, "Hej!").replace(/ ?\[Förnamn\]/g, "");
    for (const [field, value] of Object.entries(values)) out = out.replaceAll(field, value);
    out = sender.phone
      ? out.replaceAll("[Telefonnummer]", sender.phone)
      : out.replace(/^\[Telefonnummer\]\n?/gm, "").replaceAll("[Telefonnummer]", "");
    return out;
  }

  const subject = fill(opts.subjectTemplate).replace(/\s+/g, " ").trim();
  const body = fill(opts.bodyTemplate).trim();
  const linkText = `Se förslaget för ${lead.orgName.trim()}`;

  const text = `${body.replaceAll(LINK_FIELD, `${linkText}: ${opts.proposalUrl}`)}\n\n—\n${FOOTER_TEXT}`;

  const paragraphs = body.split(/\n{2,}/);
  const htmlParts = paragraphs.map((para) => {
    const lines = para.split("\n");
    const linked = (line: string) =>
      escapeHtml(line)
        .replace(
          escapeHtml(LINK_FIELD),
          `<a href="${escapeHtml(opts.proposalUrl)}" style="color:#6D614D;font-weight:600">${escapeHtml(linkText)}</a>`
        )
        .replace(/https:\/\/roots\.nu(?![\w/])/g, '<a href="https://roots.nu" style="color:#6D614D">roots.nu</a>');
    if (lines.every((l) => l.startsWith("• "))) {
      const items = lines.map((l) => `<li style="margin:0 0 6px">${linked(l.slice(2))}</li>`).join("");
      return `<ul style="margin:0 0 16px;padding-left:20px">${items}</ul>`;
    }
    const single = lines.length === 1 ? lines[0]! : "";
    const isHeading =
      single.length > 0 &&
      single.length < 80 &&
      !/[.!,:]$/.test(single) &&
      !single.startsWith("Hej") &&
      !single.includes(LINK_FIELD);
    const inner = lines.map(linked).join("<br>");
    return isHeading
      ? `<p style="margin:20px 0 8px;font-weight:600">${inner}</p>`
      : `<p style="margin:0 0 16px">${inner}</p>`;
  });

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff"><div style="max-width:600px;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2B2620">${htmlParts.join("")}<p style="margin:28px 0 0;padding-top:12px;border-top:1px solid #E5DDD2;font-size:12px;line-height:1.5;color:#7F715B">${escapeHtml(FOOTER_TEXT).replace("https://roots.nu/integritet", '<a href="https://roots.nu/integritet" style="color:#7F715B">roots.nu/integritet</a>')}</p></div></body></html>`;

  return { subject, text, html, missing };
}
