/**
 * Publik FAQ-data för /hjalp — delas mellan klient-sidan och
 * server-side FaqJsonLd i layouten (page.tsx är "use client").
 *
 * Note: the live help page primarily uses `pages.hjalp` dictionaries;
 * this module is kept bilingual for JSON-LD / legacy imports.
 */

import type { Locale } from "@/i18n/config";

export type HelpFaq = {
  question: string;
  answer: string;
};

const PUBLIC_FAQS: Record<Locale, HelpFaq[]> = {
  sv: [
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
  ],
  en: [
    {
      question: "What is Roots?",
      answer:
        "A fundraising platform where clubs sell products through personal shops. Payment via Klarna or directly to the team leader.",
    },
    {
      question: "How do we start a campaign?",
      answer:
        "Visit the contact page or book a demo. One of our account managers will contact you within 24 hours.",
    },
    {
      question: "What does it cost?",
      answer:
        "Roots charges no start-up fees — we are funded through the margin on products sold. Contact sales for the current price list.",
    },
    {
      question: "Is it GDPR-safe?",
      answer:
        "Yes. All data is stored within the EU, payments are handled by Klarna, and we log user actions for auditability.",
    },
    {
      question: "What is a personal shop?",
      answer:
        "Every seller gets their own shop page with a link and QR code. Friends and family order from there — the purchase is attributed to the right team and seller in the portal. No cash handling or carrying boxes.",
    },
    {
      question: "How much does the club keep?",
      answer:
        "The club keeps 35% of sales under a fixed model. The same figure appears in the calculator, portal and outward communication so team leaders and sellers speak the same language.",
    },
    {
      question: "How does delivery work?",
      answer:
        "The customer pays online and the product is shipped home (or via collective delivery to the team leader when selected). The seller only shares the link or QR code — no packing or delivery from the team.",
    },
    {
      question: "How is Roots different from selling sweets?",
      answer:
        "Sweets often require stock, carrying and manual payment. With Roots the flow is digital: no club stock with the seller, online payment and delivery to the customer. Premium hair care can also become a recurring habit — not just a one-off campaign.",
    },
  ],
};

/** Role-agnostic FAQ (About Roots) — indexed via FAQPage JSON-LD. */
export function getHelpPublicFaqs(locale: Locale = "sv"): HelpFaq[] {
  return PUBLIC_FAQS[locale];
}

/** @deprecated Prefer getHelpPublicFaqs(locale) */
export const HELP_PUBLIC_FAQS: HelpFaq[] = PUBLIC_FAQS.sv;
