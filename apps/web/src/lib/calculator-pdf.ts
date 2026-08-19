import type { CalculatorInputs, CalculatorResult } from "@roots/contracts";

const FOREST = { r: 107, g: 121, b: 79 };
const SAND = { r: 241, g: 235, b: 226 };
const INK = { r: 29, g: 29, b: 27 };
const WHITE = { r: 255, g: 255, b: 255 };

function money(kr: number, locale: string): string {
  const tag = locale === "en" ? "en-GB" : "sv-SE";
  const n = Math.round(kr).toLocaleString(tag);
  return locale === "en" ? `SEK ${n}` : `${n} kr`;
}

export async function downloadCalculatorPdf(opts: {
  inputs: CalculatorInputs;
  result: CalculatorResult;
  locale: string;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { inputs, result, locale } = opts;
  const sv = locale !== "en";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(SAND.r, SAND.g, SAND.b);
  doc.rect(0, 0, w, h, "F");

  doc.setFillColor(FOREST.r, FOREST.g, FOREST.b);
  doc.rect(0, 0, w, 62, "F");

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(sv ? "ROOTS  ·  RÄKNESNURRA" : "ROOTS  ·  CALCULATOR", 16, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(sv ? "Er förening tjänar" : "Your club earns", 16, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text(money(result.earningsKr, locale), 16, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    sv
      ? `av ${money(result.grossKr, locale)} i total försäljning  ·  ${result.marginPercent} %`
      : `of ${money(result.grossKr, locale)} in total sales  ·  ${result.marginPercent}%`,
    16,
    56
  );

  const rows: [string, string][] = [
    [sv ? "Hur många säljer?" : "How many are selling?", String(result.sellers)],
    [
      sv ? "Hur mycket säljer var och en?" : "Average per person",
      money(inputs.avgPerSellerKr, locale),
    ],
    [sv ? "Föreningens andel" : "Club share", `${result.marginPercent} %`],
    [sv ? "Total försäljning" : "Total sales", money(result.grossKr, locale)],
    [
      sv ? "Per säljare till er" : "Per seller to you",
      money(result.earningsPerSellerKr, locale),
    ],
  ];
  if (result.goalKr) {
    rows.push([
      sv ? "Insamlingsmål" : "Fundraising goal",
      `${money(result.goalKr, locale)}  (${result.goalPct ?? 0} %)`,
    ]);
  }

  let y = 78;
  doc.setDrawColor(FOREST.r, FOREST.g, FOREST.b);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 86);
    doc.text(label, 16, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(value, w - 16, y, { align: "right" });
    doc.setDrawColor(213, 202, 191);
    doc.line(16, y + 4, w - 16, y + 4);
    y += 14;
  }

  y += 8;
  doc.setFillColor(FOREST.r, FOREST.g, FOREST.b);
  doc.roundedRect(16, y, w - 32, 22, 3, 3, "F");
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const formula = sv
    ? `${result.sellers}  ×  ${money(inputs.avgPerSellerKr, locale)}  ×  ${result.marginPercent} %  =  ${money(result.earningsKr, locale)}`
    : `${result.sellers}  ×  ${money(inputs.avgPerSellerKr, locale)}  ×  ${result.marginPercent}%  =  ${money(result.earningsKr, locale)}`;
  doc.text(formula, w / 2, y + 13, { align: "center" });

  doc.setTextColor(90, 90, 86);
  doc.setFontSize(9);
  const disclaimer = sv
    ? "En uppskattning utifrån era antaganden. Faktisk förtjänst beror på hur mycket föreningen säljer."
    : "An estimate based on your assumptions. Actual earnings depend on how much the club sells.";
  doc.text(disclaimer, 16, h - 22, { maxWidth: w - 32 });

  const date = new Date().toLocaleDateString(sv ? "sv-SE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(FOREST.r, FOREST.g, FOREST.b);
  doc.text(`roots.nu   ·   ${date}`, 16, h - 12);

  doc.save(sv ? "Roots-Raknesnurra.pdf" : "Roots-Calculator.pdf");
}
