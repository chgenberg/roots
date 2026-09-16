import {
  isAgentFigure,
  type DeskAccent,
  AGENT_FIGURES,
} from "@roots/contracts";
import { stampBlocks } from "./briefing-blocks";
import { formatIntake } from "./desk-topics";
import {
  actionLabel,
  eventLabel,
  type ConductorAction,
  type ConductorEvent,
} from "./conductor-catalog";
import {
  attachOrphanRules,
  listDesks,
  createDesk,
  updateDesk,
} from "./conductor-store";

export type SeedDesk = {
  key: string;
  name: string;
  blurb: string;
  accent: DeskAccent;
};

export const SEED_DESKS: SeedDesk[] = [
  {
    key: "forening",
    name: "Förening",
    blurb: "Granskning, inbjudningar, kalkyl-leads och onboarding.",
    accent: "ink",
  },
  {
    key: "orderliv",
    name: "Orderliv",
    blurb: "Kassa, bekräftelse och vad som händer när en order rör sig.",
    accent: "orange",
  },
  {
    key: "pengar",
    name: "Pengar",
    blurb: "Avräkning och utbetalning. Du trycker PAID. Inget skickas av sig självt.",
    accent: "cerise",
  },
  {
    key: "mejl",
    name: "Mejl",
    blurb: "Utkast till utskick. Mejlpausen lyfter jag inte.",
    accent: "faint",
  },
  {
    key: "drift",
    name: "Drift",
    blurb: "Heartbeat, grind och tysta jobb. Aldrig deploy.",
    accent: "orange",
  },
];

export { DESK_ACCENTS, isDeskAccent } from "@roots/contracts";

export async function ensureSeededDesks(): Promise<void> {
  const existing = await listDesks();
  const have = new Set(existing.map((d) => d.key));
  for (const seed of SEED_DESKS) {
    if (have.has(seed.key)) continue;
    await createDesk({
      key: seed.key,
      name: seed.name,
      blurb: seed.blurb,
      accent: seed.accent,
    });
  }
  await ensurePortraits();
  await attachOrphanRules();
}

export async function ensurePortraits(): Promise<void> {
  const desks = await listDesks();
  const used = new Set<number>();
  for (const desk of desks) {
    const keep =
      desk.portrait &&
      isAgentFigure(desk.portrait) &&
      !used.has(desk.portrait);
    if (keep) {
      used.add(desk.portrait as number);
      continue;
    }
    let next: number | null = null;
    for (let n = 1; n <= AGENT_FIGURES; n++) {
      if (!used.has(n)) {
        next = n;
        break;
      }
    }
    if (!next) break;
    used.add(next);
    await updateDesk(desk.id, { portrait: next });
  }
}

export function followUpForText(text: string): string | null {
  const lower = text.toLowerCase();
  const when =
    /(^|[.!?]\s)(när|om|efter|vid)\b|så fort|när en |när någon |när en order|när en kampanj|när en förening|\binbjud|\blead/.test(
      lower
    );
  const then =
    /skriv|skicka|öppna|lägg|mejla|maila|fortnox|kort|påminn|utkast|mall/.test(
      lower
    );
  if (text.trim().length < 12) {
    return "Kort. När ska jag göra det, och vad ska jag göra? En mening räcker.";
  }
  if (!when && then) {
    return "Vad ska utlösa det? Till exempel när en order läggs, när en förening väntar eller när någon lämnar en lead.";
  }
  if (when && !then) {
    return "Vad ska jag göra då? Öppna ett kort, lägga mejlutkast eller Fortnox-utkast?";
  }
  return null;
}

export function looksLikeAutomation(text: string): boolean {
  const lower = text.toLowerCase();
  return /när |så fort|skriv fortnox|öppna (ett )?kort|skicka (en )?mall|lägg (ett )?utkast/.test(
    lower
  );
}

export function looksLikeTraining(text: string): boolean {
  const lower = text.toLowerCase();
  return /du ska |din uppgift|din roll|ta hand om|sköt |sköta |hantera |ansvar(?:ar)? för|utbilda|arbetsbeskriv|från och med nu|jag vill att du/.test(
    lower
  );
}

export function looksLikeOpenJob(text: string): boolean {
  return looksLikeTraining(text);
}

export function briefingNeedsIntake(briefing: string | null | undefined): boolean {
  const t = briefing?.trim() ?? "";
  if (!t) return false;
  return /KLART:\s*nej|SAKNAS:/i.test(t);
}

export function briefingIsReady(briefing: string | null | undefined): boolean {
  const t = briefing?.trim() ?? "";
  if (!t) return false;
  return !briefingNeedsIntake(t);
}

export function openBriefingStub(
  text: string,
  existing?: string | null
): string | null {
  if (briefingIsReady(existing)) return null;
  return stampBlocks({
    existing,
    jag: existing?.trim() ? undefined : `Uppdrag: ${text.trim().slice(0, 200)}`,
    saknas: "när, vad, vem godkänner, vad som är klart",
    ready: false,
  });
}

export function intakeFallback(
  name: string,
  text: string,
  desk?: { key?: string; name?: string }
): string {
  return formatIntake(name, text, desk ?? { name });
}

export function replyForDraft(args: {
  title: string;
  trigger: ConductorEvent;
  action: ConductorAction;
}): string {
  const when = eventLabel(args.trigger);
  const then = actionLabel(args.action);
  const money =
    args.action === "fortnox.draft"
      ? " Det är ett Fortnox-utkast. Inget skickas. Du trycker bokför."
      : args.action === "email.draft"
        ? " Mejl går inte förrän du godkänner. Mejlpausen lyfter jag inte."
        : "";
  return `Jag lägger utkastet “${args.title}”. När ${when} → ${then}.${money} Godkänn till höger när det stämmer.`;
}

export function greetingForDesk(args: {
  name: string;
  on: number;
  waiting: number;
  titles: string[];
}): string {
  const jobs =
    args.titles.length > 0
      ? ` Jag har redan: ${args.titles.slice(0, 3).join(", ")}.`
      : " Jag har inga uppdrag än.";
  const wait =
    args.waiting > 0
      ? ` ${args.waiting} utkast väntar på att du godkänner.`
      : "";
  const on = args.on > 0 ? ` ${args.on} är på.` : "";
  return `Jag är ${args.name}.${jobs}${on}${wait} Säg vad jag ska göra, som till en anställd.`;
}
