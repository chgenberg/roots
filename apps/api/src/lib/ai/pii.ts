/**
 * Scout fix 2026-05-26 (AI-CRIT-03 / AI-HIGH-02):
 *
 * PII-skrubbning innan vi skickar fritextsfält till OpenAI.
 *
 * Tidigare hade hair-analysis-routen sin egen lokala `scrubPii` /
 * `sanitizeNotes` men chat-routerna (public + portal) skickade rå
 * user-input verbatim till OpenAI. Vi flyttar funktionerna hit så
 * alla AI-ytor kan använda samma regex-bank.
 *
 * Filosofi: vi vill INTE bygga en NER-pipeline här. Målet är "stoppa
 * det uppenbara" — personnummer, telefon, email, IBAN, kortnummer.
 * Vid jämförelse med ChatGPT/OpenAI Console där vi kan se promptarna
 * ska identifierande information inte stå i klartext.
 */

/**
 * Tar bort kontrolltecken + neutraliserar enkla prompt-injection-
 * trick (override-fraser, ``` code-fence-takeover etc.) i fritext.
 * Tänkt för fält som "notes" där användaren kan skriva fritt men
 * inte ska kunna injicera nya instruktioner.
 */
export function sanitizeNotes(raw: string, max = 500): string {
  return raw
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/```/g, "'''")
    .replace(/\b(ignore|disregard|override)\s+(previous|prior|all)\s+(instructions?|prompts?|rules?)/gi, "[redacted]")
    .replace(/\bSYSTEM:?/gi, "[redacted]")
    .replace(/^\s*#{3,}.*$/gm, "")
    .slice(0, max);
}

/**
 * Skrubbar bort identifierande PII-mönster. Säkert att köra på vilken
 * sträng som helst — alla matchningar ersätts med en tag som visar
 * VAD som skrubbades så modellen ändå förstår kontexten ("kundens
 * [redacted-telefon]" kvarstår som koherent text).
 */
export function scrubPiiText(text: string): string {
  return text
    .replace(/\b\d{6,8}[-\s]?\d{4}\b/g, "[redacted-personnummer]")
    .replace(/\b(?:\+?46|0)[\s-]?7\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, "[redacted-telefon]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[redacted-iban]")
    .replace(/\b\d{13,19}\b/g, "[redacted-långt-nummer]");
}
