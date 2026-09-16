export type DeskRoleKey =
  | "forening"
  | "orderliv"
  | "pengar"
  | "mejl"
  | "drift";

export type DeskFlowStep = {
  id: string;
  title: string;
  note: string;
  hot: "site" | "desks" | "draft" | "approve" | "do";
};

export const DESK_FLOW_STEPS: DeskFlowStep[] = [
  {
    id: "site",
    title: "Något händer på sajten",
    note: "En order, en lead, en förening som väntar eller en avräkning.",
    hot: "site",
  },
  {
    id: "route",
    title: "Rätt anställd tar det",
    note: "Förening, Orderliv, Pengar, Mejl eller Drift. I mitten delar de upp.",
    hot: "desks",
  },
  {
    id: "draft",
    title: "Utkast, inget går ut",
    note: "Hen lägger uppdraget som utkast. Du ser det i chatten till höger.",
    hot: "draft",
  },
  {
    id: "approve",
    title: "Du godkänner",
    note: "Godkänn och slå på. Utan ditt ja händer inget irreversibelt.",
    hot: "approve",
  },
  {
    id: "do",
    title: "Hen gör det när det händer igen",
    note: "Öppnar kort eller lägger utkast. Inte PAID. Inte deploy. Inte mejlpaus.",
    hot: "do",
  },
];

export type DeskRole = {
  key: DeskRoleKey;
  name: string;
  watches: string;
  does: string;
};

export const DESK_ROLES: DeskRole[] = [
  {
    key: "forening",
    name: "Förening",
    watches: "Ny förening, inbjudan, kalkyl-lead, kampanj.",
    does: "Öppnar kort och förbereder inbjudan. Du godkänner föreningen.",
  },
  {
    key: "orderliv",
    name: "Orderliv",
    watches: "Order lagd, betald, misslyckad, kampanj slut.",
    does: "Öppnar kort och lägger mejlutkast kring ordern.",
  },
  {
    key: "pengar",
    name: "Pengar",
    watches: "Avräkning redo, utbetalning väntar.",
    does: "Skriver Fortnox-utkast och pay-pack. Du trycker PAID.",
  },
  {
    key: "mejl",
    name: "Mejl",
    watches: "Inbjudan, kvitto, mejlpaus.",
    does: "Lägger utkast. Mejlpausen lyfter hen inte.",
  },
  {
    key: "drift",
    name: "Drift",
    watches: "Grind, tysta jobb, heartbeat.",
    does: "Öppnar kort. Deploy körs aldrig.",
  },
];

export const SITE_EVENTS = [
  { id: "order", label: "Order" },
  { id: "forening", label: "Förening" },
  { id: "lead", label: "Lead" },
  { id: "pengar", label: "Pengar" },
  { id: "mejl", label: "Mejl" },
] as const;

export const DESK_ACTIONS = [
  { id: "card", label: "Kort" },
  { id: "fortnox", label: "Fortnox-utkast" },
  { id: "mail", label: "Mejlutkast" },
] as const;

export function roleByKey(key: string): DeskRole | undefined {
  return DESK_ROLES.find((r) => r.key === key);
}
