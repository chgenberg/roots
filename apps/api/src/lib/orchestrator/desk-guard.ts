/**
 * Vakt på axeln. Hårda nej utan modell. Mjuk skrubb finns i desk-brain.
 * Underkänd text når inte Godkänn.
 */

export type GuardVerdict = { ok: true } | { ok: false; reason: string };

const HARD = [
  { re: /\bdeploy(?:a|as|ing)?\b/i, reason: "Deploy får inte köras." },
  {
    re: /\bpaid\b|markera som betald|tryck(?:er)? paid/i,
    reason: "PAID trycks inte härifrån.",
  },
  {
    re: /lyft mejlpaus|feature_email_disabled|slå på (riktig )?mejl/i,
    reason: "Mejlpausen lyfts inte härifrån.",
  },
  {
    re: /skicka (till )?fortnox|bokför (nu|direkt)|fortnox-skick/i,
    reason: "Fortnox skickas inte härifrån. Utkast går bra.",
  },
  {
    re: /banköverför|för över till bank/i,
    reason: "Banken rörs inte härifrån.",
  },
];

export function guardDraft(text: string): GuardVerdict {
  const t = text.trim();
  if (!t) return { ok: false, reason: "Tomt utkast." };
  for (const row of HARD) {
    if (row.re.test(t)) return { ok: false, reason: row.reason };
  }
  return { ok: true };
}

export function guardDrafts(
  rows: { title: string; action?: string }[]
): GuardVerdict {
  for (const row of rows) {
    const hit = guardDraft(`${row.title} ${row.action ?? ""}`);
    if (!hit.ok) return hit;
  }
  return { ok: true };
}
