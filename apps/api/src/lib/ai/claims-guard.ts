/**
 * Serversidigt filter mot medicinska påståenden i AI-svar.
 *
 * Roots säljer kosmetika. Enligt EU-förordning 1223/2009 får kosmetiska
 * produkter inte marknadsföras med påståenden om att de behandlar, botar
 * eller förebygger sjukdom — då är det ett läkemedel, med helt andra krav.
 * Ett "botar mjäll" eller "hjälper mot eksem" i ett chattsvar är vårt
 * problem, inte modellens.
 *
 * Systemprompten förbjuder redan sådana formuleringar, men en prompt är en
 * önskan: jailbreak, modellbyte eller drift kan ändra utfallet. Det här är
 * spärren som faktiskt håller, eftersom den sitter på texten vi skickar ut.
 *
 * Design:
 *   - Vi blockerar hela svaret istället för att maskera enstaka ord. Ett
 *     halvraderat medicinskt råd är sämre än ett vänligt "kontakta oss".
 *   - Mönstren siktar på VERB + TILLSTÅND, inte på tillståndsordet självt.
 *     Att chatten får säga "om du har torr hårbotten" är helt i ordning;
 *     det är "botar", "behandlar", "läker" som är problemet.
 */

const CONDITIONS = [
  "eksem",
  "psoriasis",
  "svamp",
  "seborroisk dermatit",
  "dermatit",
  "håravfall",
  "alopeci",
  "alopecia",
  "flint",
  "infektion",
  "akne",
  "rosacea",
  "cancer",
  "sjukdom",
  "sjukdomar",
  "mjäll",
  "kliande hårbotten",
];

const TREATMENT_VERBS = [
  "bota[r]?",
  "botad[e]?",
  "behandla[r]?",
  "behandlad[e]?",
  "läker",
  "läka",
  "kurera[r]?",
  "eliminera[r]?",
  "tar bort",
  "får bort",
  "motverka[r]?",
  "förebygger",
  "stoppar",
  "avhjälper",
  "heal[s]?",
  "cure[s]?",
  "treat[s]?",
];

/**
 * "botar mjäll", "behandlar eksem", "tar bort svamp" — verb och tillstånd
 * inom ~40 tecken från varandra, så mellanliggande ord ("behandlar effektivt
 * din torra") fortfarande fångas.
 */
const TREATMENT_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(?:${TREATMENT_VERBS.join("|")})\\b[^.!?]{0,40}?\\b(?:${CONDITIONS.join("|")})\\b`,
    "i"
  ),
  // Omvänd ordning: "eksem behandlas med", "mjäll försvinner med".
  new RegExp(
    `\\b(?:${CONDITIONS.join("|")})\\b[^.!?]{0,40}?\\b(?:${TREATMENT_VERBS.join("|")}|försvinner|botas|behandlas)\\b`,
    "i"
  ),
  // Direkta läkemedelsanspråk och diagnoser.
  /\b(?:medicinsk|kliniskt bevisad|klinisk studie visar|receptfri|läkemedel|diagnos(?:tiserar|en)?)\b/i,
  /\bdu (?:har|lider av|verkar ha)\b[^.!?]{0,30}?\b(?:eksem|psoriasis|svamp|dermatit|alopeci|infektion)\b/i,
];

export interface ClaimsCheck {
  /** True när texten är fri från medicinska påståenden. */
  ok: boolean;
  /** Vilket mönster som slog till — loggas, visas aldrig för användaren. */
  matched?: string;
}

export function checkMedicalClaims(text: string): ClaimsCheck {
  if (!text) return { ok: true };
  for (const pattern of TREATMENT_PATTERNS) {
    const hit = pattern.exec(text);
    if (hit) return { ok: false, matched: hit[0].slice(0, 120) };
  }
  return { ok: true };
}

/**
 * Strömmande varianten. Ett svar som skickas token för token kan inte
 * granskas efteråt — texten är redan hos användaren. Filtret håller därför
 * tillbaka ord fram till närmaste meningsslut, granskar den färdiga
 * meningen och släpper den vidare först när den är ren.
 *
 * Att meningen är granskningsenheten är inget hack: mönstren ovan tillåter
 * inte `.?!` mellan verb och tillstånd, så ett påstående kan inte gömma sig
 * över en meningsgräns.
 *
 * Kostnaden är att texten kommer i meningsvis skutt i stället för ord för
 * ord. Det är ett medvetet byte — en aning mindre elegant skrivmaskins-
 * effekt mot att aldrig visa ett medicinskt påstående i klartext.
 */
export function createClaimsStreamFilter() {
  let pending = "";
  let blocked = false;

  function takeCompleteSentences(): string {
    // Sista positionen där en mening avslutas (punkt, utrop, fråga,
    // radbrytning) följt av blanksteg eller strängslut.
    const match = /[.!?…]\s|\n/g;
    let lastEnd = -1;
    let hit: RegExpExecArray | null;
    while ((hit = match.exec(pending)) !== null) {
      lastEnd = hit.index + hit[0].length;
    }
    if (lastEnd === -1) return "";
    const complete = pending.slice(0, lastEnd);
    pending = pending.slice(lastEnd);
    return complete;
  }

  function evaluate(text: string): StreamFilterResult {
    const check = checkMedicalClaims(text);
    if (!check.ok) {
      blocked = true;
      return { emit: "", blocked: true, matched: check.matched };
    }
    return { emit: text, blocked: false };
  }

  return {
    /** Matar in ett chunk och får tillbaka det som är säkert att skicka nu. */
    push(chunk: string): StreamFilterResult {
      if (blocked) return { emit: "", blocked: true };
      pending += chunk;
      const complete = takeCompleteSentences();
      if (!complete) return { emit: "", blocked: false };
      return evaluate(complete);
    },

    /** Anropas när strömmen är slut — släpper sista ogranskade resten. */
    flush(): StreamFilterResult {
      if (blocked) return { emit: "", blocked: true };
      const rest = pending;
      pending = "";
      if (!rest) return { emit: "", blocked: false };
      return evaluate(rest);
    },
  };
}

export interface StreamFilterResult {
  /** Text som är granskad och säker att skicka vidare. */
  emit: string;
  /** True när svaret ska stoppas och ersättas med CLAIMS_BLOCKED_REPLY. */
  blocked: boolean;
  matched?: string;
}

/** Vad användaren ser i stället för ett blockerat svar. */
export const CLAIMS_BLOCKED_REPLY =
  "Där vill jag inte gissa. Roots är hudvård och hårvård, inte läkemedel, " +
  "så jag kan inte uttala mig om hudbesvär eller behandlingar. Handlar det " +
  "om något som besvärar dig är frisör, hudterapeut eller läkare rätt " +
  "instans. Vill du veta vad produkterna innehåller och hur de används " +
  "svarar jag gärna på det — eller maila hej@roots.se.";
