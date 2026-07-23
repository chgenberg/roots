/**
 * Datum-helpers för säljperiod-logik.
 *
 * Kampanjernas `startDate`/`endDate` är rena datum (YYYY-MM-DD) i svensk
 * kontext. Att räkna "idag" med `new Date().toISOString().slice(0,10)` ger
 * UTC-datum — mellan midnatt och 01/02 (CET/CEST) ligger UTC en dag bakåt,
 * vilket felaktigt kunde blockera/tillåta ordrar och sätta fel
 * `countsTowardStats`. Vi räknar därför alltid i Europe/Stockholm.
 */

const STOCKHOLM_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returnerar dagens datum i Europe/Stockholm som "YYYY-MM-DD". */
export function stockholmDateIso(date: Date = new Date()): string {
  // en-CA formaterar som YYYY-MM-DD, vilket är lexikografiskt jämförbart
  // med kampanjernas datumsträngar.
  return STOCKHOLM_DATE.format(date);
}
