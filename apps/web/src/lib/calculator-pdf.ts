import type { CalculatorInputs, CalculatorResult } from "@roots/contracts";
import type { jsPDF as JsPdf } from "jspdf";

/** Säljfolderns sandbruna text- och logotypfärg. */
const BROWN = { r: 109, g: 97, b: 77 };
const MUTED = { r: 128, g: 120, b: 108 };
const HAIR = { r: 213, g: 202, b: 191 };

const FONTS = [
  { file: "/fonts/alan-sans/AlanSans-Light.ttf", name: "AlanSansLight" },
  { file: "/fonts/inter/Inter_18pt-Regular.ttf", name: "InterRegular" },
  { file: "/fonts/inter/Inter_18pt-Medium.ttf", name: "InterMedium" },
] as const;
const LOGO_SRC = "/brand/roots-logo-dark.png";
const LOGO_RATIO = 675 / 1200;
const CONTACT_EMAIL = "info@roots.nu";

type FontName = (typeof FONTS)[number]["name"];

/** Tusentalsavgränsaren i sv-SE är ett smalt hårt mellanslag som inte alla typsnitt har. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

function money(kr: number, locale: string): string {
  const tag = locale === "en" ? "en-GB" : "sv-SE";
  const n = plain(Math.round(kr).toLocaleString(tag));
  return locale === "en" ? `SEK ${n}` : `${n} kr`;
}

function count(n: number, locale: string): string {
  return plain(Math.round(n).toLocaleString(locale === "en" ? "en-GB" : "sv-SE"));
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchBase64(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok || res.headers?.get("content-type")?.includes("text/html")) return null;
    return toBase64(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadFonts(doc: JsPdf): Promise<Set<FontName>> {
  const loaded = new Set<FontName>();
  await Promise.all(
    FONTS.map(async ({ file, name }) => {
      const data = await fetchBase64(file);
      if (!data) return;
      const vfsName = `${name}.ttf`;
      doc.addFileToVFS(vfsName, data);
      doc.addFont(vfsName, name, "normal");
      loaded.add(name);
    })
  );
  return loaded;
}

export async function downloadCalculatorPdf(opts: {
  inputs: CalculatorInputs;
  result: CalculatorResult;
  locale: string;
  associationName?: string;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { inputs, result, locale } = opts;
  const sv = locale !== "en";
  const club = opts.associationName?.trim() || "";

  // A5 som säljfoldern, så att de kan skickas ihop.
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 14;
  const inner = w - margin * 2;

  const [fonts, logo] = await Promise.all([loadFonts(doc), fetchBase64(LOGO_SRC)]);
  const font = (name: FontName, fallback: "normal" | "bold" = "normal") => {
    if (fonts.has(name)) doc.setFont(name, "normal");
    else doc.setFont("helvetica", fallback);
  };
  const color = (c: { r: number; g: number; b: number }) => doc.setTextColor(c.r, c.g, c.b);

  // ── Rubrik ─────────────────────────────────────────────────────────
  font("AlanSansLight");
  color(BROWN);
  doc.setFontSize(22);
  const title = club
    ? sv
      ? `Vad kan ${club} tjäna?`
      : `What can ${club} earn?`
    : sv
      ? "Vad kan er förening tjäna?"
      : "What can your club earn?";
  const titleLines = doc.splitTextToSize(title, inner) as string[];
  let y = 24;
  doc.text(titleLines, margin, y, { lineHeightFactor: 1.15 });
  y += (titleLines.length - 1) * 9 + 8;

  font("InterRegular");
  color(MUTED);
  doc.setFontSize(8.5);
  const intro = sv
    ? `Ett räkneexempel utifrån era egna antaganden. Föreningen får ${result.marginPercent} % av allt som säljs, och Roots sköter material, digitala butiker, packning och leverans.`
    : `An example based on your own assumptions. The club keeps ${result.marginPercent}% of everything sold, and Roots handles material, digital shops, packing and delivery.`;
  const introLines = doc.splitTextToSize(intro, inner) as string[];
  doc.text(introLines, margin, y, { lineHeightFactor: 1.45 });
  y += introLines.length * 4.4 + 7;

  // ── Räkneexempel i rundad ram, som i foldern ───────────────────────
  const boxH = 46;
  const split = margin + inner * 0.48;
  doc.setDrawColor(HAIR.r, HAIR.g, HAIR.b);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, inner, boxH, 5, 5, "S");
  doc.line(split, y + 7, split, y + boxH - 7);

  font("AlanSansLight");
  color(BROWN);
  doc.setFontSize(13);
  doc.text(sv ? "Er förening tjänar" : "Your club earns", margin + 7, y + 17);
  doc.setFontSize(22);
  doc.text(money(result.earningsKr, locale), margin + 7, y + 29);
  font("InterRegular");
  color(MUTED);
  doc.setFontSize(7.5);
  doc.text(
    sv ? `Hela ${result.marginPercent} % till föreningen` : `${result.marginPercent}% to the club`,
    margin + 7,
    y + 36
  );

  const rx = split + 6;
  font("AlanSansLight");
  color(BROWN);
  doc.setFontSize(11);
  doc.text(sv ? "Ett räkneexempel" : "An example", rx, y + 11);
  font("InterRegular");
  color(MUTED);
  doc.setFontSize(7.8);
  const steps = sv
    ? [
        `${count(result.sellers, locale)} säljande medlemmar`,
        `x ${money(inputs.avgPerSellerKr, locale)} per medlem`,
        `= ${money(result.grossKr, locale)} i försäljning`,
        `x ${result.marginPercent} % till föreningen`,
      ]
    : [
        `${count(result.sellers, locale)} members selling`,
        `x ${money(inputs.avgPerSellerKr, locale)} per member`,
        `= ${money(result.grossKr, locale)} in sales`,
        `x ${result.marginPercent}% to the club`,
      ];
  steps.forEach((line, i) => doc.text(line, rx, y + 18 + i * 4.6));
  font("InterMedium", "bold");
  color(BROWN);
  doc.setFontSize(8.8);
  doc.text(
    sv
      ? `${money(result.earningsKr, locale)} till föreningen`
      : `${money(result.earningsKr, locale)} to the club`,
    rx,
    y + 18 + steps.length * 4.6 + 2.5
  );
  y += boxH + 9;

  // ── Detaljer ───────────────────────────────────────────────────────
  const rows: [string, string][] = [
    [sv ? "Antal säljande medlemmar" : "Members selling", count(result.sellers, locale)],
    [sv ? "Försäljning per medlem" : "Sales per member", money(inputs.avgPerSellerKr, locale)],
    [sv ? "Total försäljning" : "Total sales", money(result.grossKr, locale)],
    [sv ? "Föreningens andel" : "Club share", `${result.marginPercent} %`],
    [sv ? "Till föreningen per medlem" : "To the club per member", money(result.earningsPerSellerKr, locale)],
  ];
  if (result.goalKr) {
    rows.push([
      sv ? "Föreningens mål" : "Club goal",
      `${money(result.goalKr, locale)}  ·  ${result.goalPct ?? 0} %`,
    ]);
  }
  doc.setFontSize(8.5);
  for (const [label, value] of rows) {
    font("InterRegular");
    color(MUTED);
    doc.text(label, margin, y);
    font("InterMedium", "bold");
    color(BROWN);
    doc.text(value, w - margin, y, { align: "right" });
    doc.setDrawColor(HAIR.r, HAIR.g, HAIR.b);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 3, w - margin, y + 3);
    y += 8.2;
  }

  y += 5;
  font("AlanSansLight");
  color(BROWN);
  doc.setFontSize(12.5);
  const closing = sv
    ? "Tillsammans skapar vi en försäljning som är smidig och värdefull för hela föreningen."
    : "Together we create a sale that is smooth and valuable for the whole club.";
  doc.text(doc.splitTextToSize(closing, inner) as string[], margin, y, { lineHeightFactor: 1.3 });

  // ── Sidfot: kontakt till vänster, logga med devis till höger ──────
  const footTop = h - 34;
  doc.setDrawColor(HAIR.r, HAIR.g, HAIR.b);
  doc.setLineWidth(0.25);
  doc.line(margin, footTop, w - margin, footTop);

  font("AlanSansLight");
  color(BROWN);
  doc.setFontSize(10);
  doc.text(sv ? "Kontakt" : "Contact", margin, footTop + 9);
  font("InterRegular");
  color(MUTED);
  doc.setFontSize(7.5);
  doc.text(CONTACT_EMAIL, margin, footTop + 14.5);
  const date = new Date().toLocaleDateString(sv ? "sv-SE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(sv ? `Framtaget ${date}` : `Prepared ${date}`, margin, footTop + 19);
  doc.setFontSize(6.3);
  const disclaimer = sv
    ? "En uppskattning. Faktisk förtjänst beror på hur mycket föreningen säljer."
    : "An estimate. Actual earnings depend on how much the club sells.";
  doc.text(doc.splitTextToSize(disclaimer, inner * 0.55) as string[], margin, footTop + 25, {
    lineHeightFactor: 1.35,
  });

  const logoW = 34;
  const logoH = logoW * LOGO_RATIO;
  const logoX = w - margin - logoW;
  const logoY = footTop + 5;
  if (logo) {
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", logoX, logoY, logoW, logoH);
  } else {
    font("AlanSansLight");
    color(BROWN);
    doc.setFontSize(26);
    doc.text("roots", logoX + logoW / 2, logoY + logoH * 0.75, { align: "center" });
  }
  font("InterRegular");
  color(BROWN);
  doc.setFontSize(7);
  doc.text("Premium för föreningslivet", logoX + logoW / 2, logoY + logoH + 3.5, {
    align: "center",
  });

  const fileClub = club
    ? `-${club.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    : "";
  doc.save(sv ? `Roots-Raknesnurra${fileClub}.pdf` : `Roots-Calculator${fileClub}.pdf`);
}
