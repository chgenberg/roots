/**
 * Utbildning i fyra block plus lärdomar. Bakåt: gammal KLART/SAKNAS-text läses in.
 */

export type BriefingBlocks = {
  jag: string;
  gor: string;
  vet: string;
  saknas: string;
  lardom: string[];
  klart: boolean;
};

function section(raw: string, name: string): string {
  const re = new RegExp(
    `(?:^|\\n)${name}:\\s*([\\s\\S]*?)(?=\\n(?:JAG|GÖR|GOR|VET|SAKNAS|LÄRDOM|LARDOM|KLART):|$)`,
    "i"
  );
  const m = raw.match(re);
  return m?.[1]?.trim() ?? "";
}

export function parseBriefing(raw: string | null | undefined): BriefingBlocks {
  const t = raw?.trim() ?? "";
  if (!t) {
    return { jag: "", gor: "", vet: "", saknas: "", lardom: [], klart: false };
  }
  const jag = section(t, "JAG");
  const gor = section(t, "GÖR") || section(t, "GOR");
  const vet = section(t, "VET");
  const saknas =
    section(t, "SAKNAS") ||
    (/\nSAKNAS:\s*([^\n]+)/i.exec(t)?.[1]?.trim() ?? "");
  const lardomBlock = section(t, "LÄRDOM") || section(t, "LARDOM");
  const lardom = lardomBlock
    ? lardomBlock
        .split(/\n+/)
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
        .filter(Boolean)
        .slice(-8)
    : [];
  const hasSections = Boolean(jag || gor || vet || saknas || lardom.length);
  const klartLine = /KLART:\s*ja/i.test(t);
  const klartNej = /KLART:\s*nej/i.test(t) || Boolean(saknas);
  return {
    jag:
      jag ||
      (!hasSections
        ? t
            .replace(/\nKLART:[^\n]*/gi, "")
            .replace(/\nSAKNAS:[^\n]*/gi, "")
            .trim()
        : ""),
    gor,
    vet: hasSections ? vet : "",
    saknas,
    lardom,
    klart: klartLine && !klartNej,
  };
}

export function compactBriefingForModel(
  raw: string | null | undefined
): string {
  const b = parseBriefing(raw);
  return formatBriefing({
    ...b,
    vet: b.vet.slice(0, 400),
    lardom: b.lardom.slice(-3),
  });
}

export function compactHistory(
  history: { role: string; text: string }[],
  keep = 4
): { role: string; text: string }[] {
  if (history.length <= keep) return history;
  const older = history.length - keep;
  const kept = history.slice(-keep).map((m) => ({
    role: m.role,
    text: m.text.slice(0, 280),
  }));
  return [
    { role: "agent", text: `Tidigare ${older} turer komprimerade.` },
    ...kept,
  ];
}

export function formatBriefing(b: BriefingBlocks): string {
  const lines: string[] = [];
  if (b.jag) lines.push(`JAG: ${b.jag}`);
  if (b.gor) lines.push(`GÖR: ${b.gor}`);
  if (b.vet) lines.push(`VET: ${b.vet}`);
  if (b.saknas && !b.klart) lines.push(`SAKNAS: ${b.saknas}`);
  if (b.lardom.length)
    lines.push(`LÄRDOM:\n${b.lardom.map((x) => `- ${x}`).join("\n")}`);
  lines.push(b.klart && !b.saknas ? "KLART: ja" : "KLART: nej");
  return lines.join("\n").slice(0, 2400);
}

export function appendLesson(
  raw: string | null | undefined,
  lesson: string
): string {
  const b = parseBriefing(raw);
  const line = lesson.trim().slice(0, 160);
  if (!line) return raw?.trim() ?? "";
  if (b.lardom.includes(line)) return formatBriefing(b);
  b.lardom = [...b.lardom, line].slice(-8);
  return formatBriefing(b);
}

export function stampBlocks(args: {
  existing?: string | null;
  jag?: string;
  gor?: string;
  vet?: string;
  saknas?: string;
  ready: boolean;
}): string {
  const b = parseBriefing(args.existing);
  if (args.jag) b.jag = args.jag.slice(0, 400);
  if (args.gor) b.gor = args.gor.slice(0, 400);
  if (args.vet) b.vet = `${b.vet}\n${args.vet}`.trim().slice(0, 800);
  b.saknas = args.ready
    ? ""
    : (args.saknas || b.saknas || "mer om uppdraget").slice(0, 400);
  b.klart = args.ready;
  return formatBriefing(b);
}
