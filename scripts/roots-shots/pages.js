// Alla användarvända sidor i Roots, grupperade per roll/kontext.
// En sanning för screenshot-riggen (shoot.mjs).
//
// auth: null            → publik sida
// auth: "<rollnyckel>"  → loggas in som den rollen först (se ACCOUNTS)

export const PASSWORD = "Demo1234!";

export const ACCOUNTS = {
  forening: { email: "forening@demo-if.se", label: "Förening (admin)" },
  lag: { email: "lag@demo-if.se", label: "Lagledare" },
  saljare: { email: "felicia.assoc@demo-if.se", label: "Säljare" },
  klubb: { email: "klubb@demo.se", label: "Klubbadmin (B2B)" },
  medlem: { email: "alma.jonsson@demo-if.se", label: "Klubbmedlem" },
  salj: { email: "salj@roots.se", label: "Säljare (intern CRM)" },
  admin: { email: "admin@roots.se", label: "Intern admin" },
};

/** Sidor som inte kräver inloggning. */
const PUBLIC = [
  ["start", "/"],
  ["foreningsliv", "/foreningsliv"],
  ["om-oss", "/om-oss"],
  ["produkter", "/produkter"],
  ["produkt-schampoo", "/produkter/shampoo"],
  ["produkt-conditioner", "/produkter/conditioner"],
  ["produkt-body-wash", "/produkter/body-wash"],
  ["sa-fungerar-det", "/sa-fungerar-det"],
  ["kontakt", "/kontakt"],
  ["hjalp", "/hjalp"],
  ["haranalys", "/haranalys"],
  ["integritet", "/integritet"],
  ["villkor", "/villkor"],
  ["login", "/login"],
  ["registrera", "/registrera"],
  ["404", "/finns-inte-denna-sida"],
];

/** Publika sidor som behöver dynamiska värden – fylls i av shoot.mjs. */
const DYNAMIC_PUBLIC = [
  ["shop", "/shop/:sellerSlug"],
  ["shop-kassa", "/shop/:sellerSlug/kassa"],
  ["kalkylator", "/kalkylator/:calcToken"],
];

const FORENING = [
  ["forening-dashboard", "/forening"],
  ["forening-statistik", "/forening/statistik"],
  ["forening-kom-igang", "/forening/kom-igang"],
  ["forening-lag", "/forening/lag"],
  ["forening-mal", "/forening/mal"],
  ["forening-kalender", "/forening/kalender"],
  ["forening-avrakning", "/forening/avrakning"],
  ["installningar", "/installningar"],
];

const LAG = [
  ["lag-dashboard", "/lag"],
  ["lag-statistik", "/lag/statistik"],
  ["lag-saljare", "/lag/saljare"],
  ["lag-bestallningar", "/lag/bestallningar"],
  ["lag-chatt", "/lag/chatt"],
  ["lag-avrakning", "/lag/avrakning"],
];

const SALJARE = [
  ["saljare-dashboard", "/min-shop"],
  ["saljare-statistik", "/min-shop/statistik"],
  ["saljare-bestallningar", "/min-shop/bestallningar"],
  ["saljare-chatt", "/min-shop/chatt"],
];

const KLUBB = [
  ["portal-klubb-dashboard", "/portal"],
  ["portal-klubb-bestallningar", "/portal/bestallningar"],
  ["portal-klubb-produkter", "/portal/produkter"],
  ["portal-klubb-fakturor", "/portal/fakturor"],
  ["portal-klubb-medlemmar", "/portal/medlemmar"],
  ["portal-klubb-intakter", "/portal/intakter"],
  ["portal-klubb-ai", "/portal/ai"],
  ["portal-klubb-installningar", "/portal/installningar"],
];

const MEDLEM = [["portal-medlem-dashboard", "/portal"]];

const SALJ_CRM = [
  ["portal-crm-dashboard", "/portal"],
  ["portal-crm-pipeline", "/portal/pipeline"],
  ["portal-crm-klubbar", "/portal/klubbar"],
  ["portal-crm-offerter", "/portal/offerter"],
  ["portal-crm-raknesnurra", "/portal/raknesnurra"],
  ["portal-crm-statistik", "/portal/statistik"],
];

const ADMIN = [
  ["portal-admin-dashboard", "/portal"],
  ["portal-admin-saljare", "/portal/saljare"],
  ["portal-admin-system", "/portal/system"],
  ["portal-admin-audit-log", "/portal/audit-log"],
];

function tag(list, auth) {
  return list.map(([name, path]) => ({ name, path, auth }));
}

export const PAGES = [
  ...tag(PUBLIC, null),
  ...tag(DYNAMIC_PUBLIC, null),
  ...tag(FORENING, "forening"),
  ...tag(LAG, "lag"),
  ...tag(SALJARE, "saljare"),
  ...tag(KLUBB, "klubb"),
  ...tag(MEDLEM, "medlem"),
  ...tag(SALJ_CRM, "salj"),
  ...tag(ADMIN, "admin"),
];
