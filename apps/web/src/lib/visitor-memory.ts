/**
 * Minns besökarens kalkyl och demo-shop i webbläsaren (localStorage), så
 * startsidan kan hälsa välkommen tillbaka. Inget skickas till servern.
 */

const CALC_KEY = "roots.memory.calc";
const DEMO_KEY = "roots.memory.demo";
const SESSION_KEY = "roots.memory.session";
const DISMISS_KEY = "roots.memory.dismissed";
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export type CalcMemory = { earningsKr: number; clubName?: string; at: number };
export type DemoMemory = {
  club: string;
  team?: string;
  goalKr?: number;
  website?: string;
  colour?: string;
  at: number;
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as T & { at?: number };
    if (!value.at || Date.now() - value.at > MAX_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

function write(key: string, value: object) {
  sessionStart();
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }));
  } catch {
    // Privat läge eller fullt lagringsutrymme — minnet är bara en bonus.
  }
}

export function rememberCalc(earningsKr: number, clubName?: string) {
  if (!Number.isFinite(earningsKr) || earningsKr <= 0) return;
  write(CALC_KEY, { earningsKr: Math.round(earningsKr), clubName: clubName?.trim() || undefined });
}

export function rememberDemo(club: string, team?: string, goalKr?: number, website?: string, colour?: string) {
  if (club.trim().length < 2) return;
  write(DEMO_KEY, {
    club: club.trim(),
    team: team?.trim() || undefined,
    goalKr,
    website: website?.trim() || undefined,
    colour: colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : undefined,
  });
}

/** Tidpunkt då den här fliksessionen började. Sätts vid första anropet. */
function sessionStart(): number {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return Number(existing);
    const now = Date.now();
    window.sessionStorage.setItem(SESSION_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

/**
 * Det som sparades vid ett tidigare besök (före den här sessionen). Det som
 * sparas under pågående besök räknas inte — då är man inte "tillbaka".
 */
export function readReturningMemory(): { calc: CalcMemory | null; demo: DemoMemory | null } {
  const start = sessionStart();
  try {
    if (window.sessionStorage.getItem(DISMISS_KEY)) return { calc: null, demo: null };
  } catch {
    // ignore
  }
  const calc = read<CalcMemory>(CALC_KEY);
  const demo = read<DemoMemory>(DEMO_KEY);
  return {
    calc: calc && calc.at < start ? calc : null,
    demo: demo && demo.at < start ? demo : null,
  };
}

export function dismissReturningMemory() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}
