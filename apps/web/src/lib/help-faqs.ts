/**
 * Publik FAQ-data för /hjalp — delas mellan klient-sidan och
 * server-side FaqJsonLd i layouten (page.tsx är "use client").
 */

export type HelpFaq = {
  question: string;
  answer: string;
};

/** Roll-agnostiska frågor (Allmänt om Roots) — indexeras via FAQPage JSON-LD. */
export const HELP_PUBLIC_FAQS: HelpFaq[] = [
  {
    question: "Vad är Roots?",
    answer:
      "En plattform för insamlings­kampanjer där föreningar säljer produkter via personliga shopar. Betalning via Klarna eller direkt till lagansvarig.",
  },
  {
    question: "Hur startar vi en kampanj?",
    answer:
      "Besök kontakt-sidan eller boka demo. En av våra ASM:er kontaktar er inom 24 timmar.",
  },
  {
    question: "Vad kostar det?",
    answer:
      "Roots tar inga uppstartsavgifter — vi finansieras via marginalen på sålda produkter. Kontakta sälj för aktuell prislista.",
  },
  {
    question: "Är det GDPR-säkert?",
    answer:
      "Ja. All data lagras inom EU, betalningar hanteras av Klarna, och vi loggar alla användaråtgärder för spårbarhet.",
  },
  {
    question: "Vad är en personlig shop?",
    answer:
      "Varje säljare får en egen shopsida med länk och QR-kod. Vänner och familj beställer därifrån — köpet räknas till rätt lag och säljare i portalen. Du behöver varken hantera kontanter eller bära runt på lådor.",
  },
  {
    question: "Hur mycket får föreningen?",
    answer:
      "Föreningen behåller 35 % av försäljningen enligt en fast modell. Samma siffra syns i kalkylatorn, portalen och kommunikationen utåt, så att lagledare och säljare pratar samma språk.",
  },
  {
    question: "Hur fungerar leveransen?",
    answer:
      "Kunden betalar online och produkten skickas hem (eller via samleverans till lagansvarig när det är valt). Säljaren delar bara länken eller QR-koden — ingen packning eller utkörning från laget.",
  },
  {
    question: "Vad skiljer Roots från godisförsäljning?",
    answer:
      "Godis kräver ofta lager, bärande och manuell betalning. Med Roots är flödet digitalt: ingen föreningslager hos säljaren, betalning online och leverans till kunden. Premium hårvård kan dessutom bli en återkommande vana — inte bara en engångskampanj.",
  },
];
