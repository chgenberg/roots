/**
 * Roots graph — shared by Cursor (orchestrator skill) and /portal/agenten.
 * Coordinates are percent of the SVG viewBox (0–100).
 */

export type DomainId =
  | "public"
  | "auth"
  | "shop"
  | "fundraising"
  | "portal"
  | "admin"
  | "email"
  | "money";

export const DOMAIN_IDS: DomainId[] = [
  "public",
  "auth",
  "shop",
  "fundraising",
  "portal",
  "admin",
  "email",
  "money",
];

export function isDomainId(value: string): value is DomainId {
  return (DOMAIN_IDS as string[]).includes(value);
}

export type LayerId = "ingress" | "brain" | "roles" | "spine" | "outbound";

export type DomainNode = {
  id: DomainId;
  label: string;
  layer: LayerId;
  x: number;
  y: number;
  blurb: string;
  files: string[];
  apis: string[];
  pulseKey?: string;
};

export type GraphEdge = {
  id: string;
  from: DomainId;
  to: DomainId;
  label: string;
};

export type PlaybookStep = {
  edgeId: string;
  nodeId: DomainId;
  note: string;
};

export type Playbook = {
  id: string;
  title: string;
  blurb: string;
  steps: PlaybookStep[];
};

export const LAYERS: { id: LayerId; label: string }[] = [
  { id: "ingress", label: "Ingång" },
  { id: "brain", label: "Agenten" },
  { id: "roles", label: "Roller" },
  { id: "spine", label: "Ryggrad" },
  { id: "outbound", label: "Ut" },
];

export const NODES: DomainNode[] = [
  {
    id: "public",
    label: "Publik",
    layer: "ingress",
    x: 14,
    y: 16,
    blurb: "Det besökaren ser utan konto.",
    files: [
      "apps/web/src/app/(marketing)/page.tsx",
      "apps/web/src/app/(marketing)/foreningsliv/page.tsx",
    ],
    apis: [],
  },
  {
    id: "auth",
    label: "Auth",
    layer: "ingress",
    x: 38,
    y: 16,
    blurb: "Session, roll och preview-gate.",
    files: [
      "apps/api/src/routes/auth.ts",
      "apps/web/src/middleware.ts",
    ],
    apis: ["/v1/auth"],
  },
  {
    id: "shop",
    label: "Shop",
    layer: "spine",
    x: 66,
    y: 16,
    blurb: "Produkter, kassa och Stripe.",
    files: [
      "apps/api/src/routes/shop.ts",
      "apps/api/src/routes/checkout.ts",
      "apps/web/src/app/(marketing)/produkter/page.tsx",
    ],
    apis: ["/v1/shop", "/v1/checkout"],
  },
  {
    id: "fundraising",
    label: "Insamling",
    layer: "roles",
    x: 16,
    y: 44,
    blurb: "Förening, lag och min-shop.",
    files: [
      "apps/api/src/routes/dashboard.ts",
      "apps/api/src/routes/association.ts",
      "apps/web/src/app/(fundraising)/forening/page.tsx",
    ],
    apis: ["/v1/dashboard", "/v1/association"],
  },
  {
    id: "portal",
    label: "Portal",
    layer: "roles",
    x: 42,
    y: 44,
    blurb: "Klubb- och säljardashboard.",
    files: [
      "apps/api/src/routes/portal.ts",
      "apps/api/src/routes/sales.ts",
      "apps/web/src/app/(portal)/portal/portal-shell.tsx",
    ],
    apis: ["/v1/portal", "/v1/sales"],
  },
  {
    id: "admin",
    label: "Admin",
    layer: "roles",
    x: 72,
    y: 44,
    blurb: "Intern admin, OS-tavla och grindar.",
    files: [
      "apps/api/src/lib/orchestrator/graph.ts",
      "apps/api/src/routes/admin.ts",
      "apps/web/src/app/(portal)/portal/agenten/page.tsx",
    ],
    apis: ["/v1/admin/orchestrator"],
    pulseKey: "pending-orgs",
  },
  {
    id: "email",
    label: "Mejl",
    layer: "outbound",
    x: 28,
    y: 74,
    blurb: "Transaktionsmejl. Respektera FEATURE_EMAIL_DISABLED.",
    files: ["apps/api/src/lib/email/index.ts"],
    apis: [],
    pulseKey: "email-paused",
  },
  {
    id: "money",
    label: "Pengar",
    layer: "outbound",
    x: 64,
    y: 74,
    blurb: "35 %, Stripe, utbetalning, Fortnox. Alltid grind.",
    files: [
      "apps/api/src/routes/payouts.ts",
      "apps/api/src/routes/settlement.ts",
      "packages/db/src/schema/payouts.ts",
    ],
    apis: ["/v1/payouts", "/v1/settlement"],
    pulseKey: "pending-payouts",
  },
];

export const EDGES: GraphEdge[] = [
  { id: "public-auth", from: "public", to: "auth", label: "logga in" },
  { id: "public-shop", from: "public", to: "shop", label: "köp" },
  { id: "auth-fundraising", from: "auth", to: "fundraising", label: "förening" },
  { id: "auth-portal", from: "auth", to: "portal", label: "klubb / sälj" },
  { id: "auth-admin", from: "auth", to: "admin", label: "intern" },
  { id: "fundraising-email", from: "fundraising", to: "email", label: "inbjudan" },
  { id: "fundraising-money", from: "fundraising", to: "money", label: "35 %" },
  { id: "shop-money", from: "shop", to: "money", label: "Stripe" },
  { id: "admin-email", from: "admin", to: "email", label: "larm" },
  { id: "admin-money", from: "admin", to: "money", label: "utbetalning" },
];

export const PLAYBOOKS: Playbook[] = [
  {
    id: "supporter-buy",
    title: "Supporter köper",
    blurb: "Besökaren går från sajten till kassan.",
    steps: [
      { edgeId: "public-shop", nodeId: "public", note: "Landar på produktsidan." },
      { edgeId: "shop-money", nodeId: "shop", note: "Stripe tar betalt." },
      { edgeId: "shop-money", nodeId: "money", note: "Order och ev. föreningsandel." },
    ],
  },
  {
    id: "club-campaign",
    title: "Förening säljer",
    blurb: "Förening, lag och säljare driver en kampanj.",
    steps: [
      { edgeId: "public-auth", nodeId: "public", note: "Registrerar eller loggar in." },
      { edgeId: "auth-fundraising", nodeId: "auth", note: "Roll: förening / lag / säljare." },
      { edgeId: "fundraising-email", nodeId: "fundraising", note: "Inbjudan till säljare." },
      { edgeId: "fundraising-money", nodeId: "money", note: "Intäkt med 35 % till klubben." },
    ],
  },
  {
    id: "payout",
    title: "Utbetalning",
    blurb: "Människa markerar utbetald. Aldrig en Hand.",
    steps: [
      { edgeId: "fundraising-money", nodeId: "fundraising", note: "Kampanjen har sålt." },
      { edgeId: "admin-money", nodeId: "admin", note: "Kön syns i admin." },
      { edgeId: "admin-money", nodeId: "money", note: "irreversible — Fortnox / bank." },
    ],
  },
];

export const NODE_BY_ID: Record<DomainId, DomainNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n])
) as Record<DomainId, DomainNode>;

export const EDGE_BY_ID: Record<string, GraphEdge> = Object.fromEntries(
  EDGES.map((e) => [e.id, e])
);

export function publicGraph() {
  return { layers: LAYERS, nodes: NODES, edges: EDGES, playbooks: PLAYBOOKS };
}
