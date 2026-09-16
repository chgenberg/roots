const FORENING = [
  "När en förening väntar på granskning, öppna ett kort.",
  "När en inbjudan skapas, öppna ett kort.",
  "När någon lämnar en kalkyl-lead, öppna ett kort.",
  "När en kampanj avslutas, öppna ett kort.",
];

const ORDERLIV = [
  "När en order läggs, öppna ett kort.",
  "När en order blir betald, öppna ett kort.",
  "När en betalning misslyckas, öppna ett kort.",
  "När en order blir betald, lägg mejlutkast.",
];

const PENGAR = [
  "När en avräkning är redo, öppna ett kort.",
  "När en utbetalning väntar, öppna ett kort.",
  "När en avräkning är redo, lägg Fortnox-utkast.",
];

const MEJL = [
  "När en inbjudan skapas, lägg mejlutkast.",
  "När mejlpausen är på, öppna ett kort.",
  "När en order blir betald, lägg mejlutkast.",
];

const DRIFT = [
  "När ett jobb tystnar, öppna ett kort.",
  "När mejlpausen är på, öppna ett kort.",
  "När en förening väntar på granskning, öppna ett kort.",
];

const GENERIC = [
  "När en order läggs, öppna ett kort.",
  "När en förening väntar på granskning, öppna ett kort.",
  "När någon lämnar en kalkyl-lead, öppna ett kort.",
];

const GROUP = [
  "När en order läggs, öppna ett kort.",
  "När en förening väntar på granskning, öppna ett kort.",
  "När en utbetalning väntar, öppna ett kort.",
  "När någon lämnar en kalkyl-lead, öppna ett kort.",
];

export function ideasForDesk(desk: { key: string; name: string }): string[] {
  const key = desk.key;
  const name = desk.name.toLowerCase();
  if (key === "forening" || /förening|forening/.test(name)) return FORENING;
  if (key === "orderliv") return ORDERLIV;
  if (key === "pengar" || /pengar|bokför/.test(name)) return PENGAR;
  if (key === "mejl") return MEJL;
  if (key === "drift") return DRIFT;
  return GENERIC;
}

export function ideasForGroup(): string[] {
  return GROUP;
}
