/**
 * `db:seed:demo` — Investor-demo dataset (Sprint B).
 *
 * Builds on top of the base `seed.ts` (which creates the demo accounts
 * `klubb@demo.se`, `salj@roots.se`, `admin@roots.se` and the three
 * products). This script then layers on realistic relational data so
 * every portal surface shows live numbers instead of "—" empty states:
 *
 *  - 12 CLUB_MEMBERs in Demo Fotbollsklubb     → /portal/medlemmar, dashboard
 *  - 1 extra discovery klubb                    → /portal/klubbar shows >1 row
 *  - 1 extra SALES_REP                          → /portal/saljare shows >1 row
 *  - 5 orders (3 PAID over 3 months + 2 open)   → /portal/statistik, /intakter,
 *                                                 /bestallningar, dashboard MRR
 *  - 4 quotes by salj@roots.se                  → /portal/quotes, /pipeline
 *  - 1 active campaign + 1 team + 2 sellers     → groundwork for fundraising
 *                                                 demo flows
 *
 * Idempotency: safe to run repeatedly. Rows are skipped when a stable
 * identity already matches (org name, user email, campaign slug,
 * seller shop_slug) or when the target table already contains enough
 * demo rows to make the page render (orders ≥ 3, quotes ≥ 3).
 *
 * Usage: `pnpm -F @roots/db db:seed && pnpm -F @roots/db db:seed:demo`
 */

import { and, eq, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db } from "./client";
import {
  organizations,
  users,
  products,
  orders,
  orderLines,
  quotes,
  quoteLines,
  campaigns,
  teams,
  sellers,
  customerOrders,
  customerOrderLines,
} from "./schema";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const DEMO_PASSWORD = "Demo1234!";

// Stable list of demo member names. Real-sounding Swedish names so the
// member table looks like a real club roster, but addressed at
// `@demo-if.se` so an investor can't mistake them for live customers.
const DEMO_MEMBERS: ReadonlyArray<{ email: string; name: string }> = [
  { email: "anna.lindgren@demo-if.se", name: "Anna Lindgren" },
  { email: "erik.svensson@demo-if.se", name: "Erik Svensson" },
  { email: "sofia.karlsson@demo-if.se", name: "Sofia Karlsson" },
  { email: "oscar.bjork@demo-if.se", name: "Oscar Björk" },
  { email: "maja.holm@demo-if.se", name: "Maja Holm" },
  { email: "liam.ekstrom@demo-if.se", name: "Liam Ekström" },
  { email: "ella.nilsson@demo-if.se", name: "Ella Nilsson" },
  { email: "hugo.andersson@demo-if.se", name: "Hugo Andersson" },
  { email: "linnea.bergman@demo-if.se", name: "Linnea Bergman" },
  { email: "noah.persson@demo-if.se", name: "Noah Persson" },
  { email: "alma.jonsson@demo-if.se", name: "Alma Jonsson" },
  { email: "viktor.lund@demo-if.se", name: "Viktor Lund" },
];

// Sprint E7 (F6): these two sellers belong to `Demo Fotbollsklubb`
// (a CLUB-type org, not an association). Their emails used to be
// `@demo-if.se` which made it look like they belonged to the IF
// association — confusing during the investor demo. They now use
// `@demo.se` matching their CLUB_ADMIN org. `migrateLegacyEmails`
// below renames any pre-existing rows so seeds stay idempotent.
const DEMO_SELLER_USERS: ReadonlyArray<{
  email: string;
  name: string;
  shopSlug: string;
}> = [
  { email: "noah.saljare@demo.se", name: "Noah Berglund", shopSlug: "demo-noah" },
  { email: "alma.saljare@demo.se", name: "Alma Sundberg", shopSlug: "demo-alma" },
];

// Pre-Sprint-E7 emails → post-Sprint-E7 emails. Run once at the top
// of seed-demo. Each row is renamed only if the OLD email exists AND
// the NEW email does not, so two consecutive seed runs are safe.
const LEGACY_EMAIL_RENAMES: ReadonlyArray<{ from: string; to: string }> = [
  { from: "noah.saljare@demo-if.se", to: "noah.saljare@demo.se" },
  { from: "alma.saljare@demo-if.se", to: "alma.saljare@demo.se" },
];

interface RowWithId {
  id: string;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function ensureOrg(values: {
  name: string;
  orgNumber: string | null;
  type: string;
}): Promise<RowWithId> {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, values.name))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(organizations).values(values).returning();
  return created;
}

async function ensureUser(values: {
  email: string;
  passwordHash: string;
  role:
    | "PUBLIC"
    | "CLUB_MEMBER"
    | "CLUB_ADMIN"
    | "SALES_REP"
    | "SALES_ADMIN"
    | "INTERNAL_ADMIN"
    | "ASSOCIATION_ADMIN"
    | "TEAM_LEADER"
    | "SELLER";
  orgId: string | null;
  contactName: string;
}): Promise<RowWithId> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, values.email))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({
      email: values.email,
      passwordHash: values.passwordHash,
      role: values.role,
      orgId: values.orgId,
      contactName: values.contactName,
    })
    .returning();
  return created;
}

async function getRequiredProduct(sku: string): Promise<{
  id: string;
  priceOre: number;
}> {
  const [row] = await db
    .select({ id: products.id, priceOre: products.priceOre })
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);
  if (!row) {
    throw new Error(
      `Missing product ${sku}. Run \`pnpm -F @roots/db db:seed\` first.`
    );
  }
  return row;
}

// Sprint E7 (F6). Run BEFORE `ensureUser` for any of the renamed
// accounts so we never end up with two rows (old email + new email)
// both attached to the same seller-profile via FK.
async function migrateLegacyEmails(): Promise<void> {
  for (const { from, to } of LEGACY_EMAIL_RENAMES) {
    const [oldUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, from))
      .limit(1);
    if (!oldUser) continue;
    const [conflicting] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, to))
      .limit(1);
    if (conflicting) {
      // Pre-existing target — leave the legacy row alone so we don't
      // collide. Surfaces in the seed log so an operator can clean up.
      console.warn(
        `[seed-demo] legacy email rename skipped (target exists): ${from} → ${to}`
      );
      continue;
    }
    await db.update(users).set({ email: to }).where(eq(users.email, from));
    console.log(`[seed-demo] migrated email ${from} → ${to}`);
  }
}

async function seedDemo() {
  // Samma skäl som i seed.ts: demo-datasetet skriver över lösenord på
  // befintliga konton med ett värde som ligger i repot.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ROOTS_ALLOW_PROD_SEED !== "true"
  ) {
    throw new Error(
      "db:seed:demo vägrar köra med NODE_ENV=production. Sätt " +
        "ROOTS_ALLOW_PROD_SEED=true bara om du verkligen menar det."
    );
  }
  console.log("Seeding demo dataset…");

  await migrateLegacyEmails();

  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

  // ── 1. Base orgs + the discovery klubb ─────────────────────────────
  const clubOrg = await ensureOrg({
    name: "Demo Fotbollsklubb",
    orgNumber: "556677-8899",
    type: "club",
  });
  const salesOrg = await ensureOrg({
    name: "Roots AB",
    orgNumber: "559900-1122",
    type: "internal",
  });
  await ensureOrg({
    name: "Stockholm Allmänna Bandysällskap",
    orgNumber: "556688-1234",
    type: "club",
  });

  // ── 2. Demo accounts already created by seed.ts; we look them up. ──
  const [clubAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "klubb@demo.se"))
    .limit(1);
  const [salesRep] = await db
    .select()
    .from(users)
    .where(eq(users.email, "salj@roots.se"))
    .limit(1);
  if (!clubAdmin || !salesRep) {
    throw new Error(
      "Missing base demo users. Run `pnpm -F @roots/db db:seed` first."
    );
  }

  // ── 3. Extra säljare so /portal/saljare shows more than 1 row ──────
  await ensureUser({
    email: "maria.saljare@roots.se",
    passwordHash,
    role: "SALES_REP",
    orgId: salesOrg.id,
    contactName: "Maria Försäljning",
  });

  // ── 4. 12 klubbmedlemmar ───────────────────────────────────────────
  for (const m of DEMO_MEMBERS) {
    await ensureUser({
      email: m.email,
      passwordHash,
      role: "CLUB_MEMBER",
      orgId: clubOrg.id,
      contactName: m.name,
    });
  }
  console.log(
    `Members: ensured ${DEMO_MEMBERS.length} CLUB_MEMBERs in ${clubOrg.id}`
  );

  // ── 5. Orders (statistik / intäkter / dashboard MRR) ───────────────
  const shampoo = await getRequiredProduct("ROOTS-SH-001");
  const conditioner = await getRequiredProduct("ROOTS-CO-001");
  const bodyWash = await getRequiredProduct("ROOTS-BW-001");

  const [orderCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.orgId, clubOrg.id));

  if (Number(orderCount?.count ?? 0) < 3) {
    const demoOrders: ReadonlyArray<{
      createdAt: Date;
      status: "DELIVERED" | "SHIPPED" | "PENDING";
      invoiceStatus: "PAID" | "PENDING" | "NONE";
      lines: ReadonlyArray<{
        productId: string;
        priceOre: number;
        qty: number;
      }>;
    }> = [
      {
        createdAt: daysAgo(85),
        status: "DELIVERED",
        invoiceStatus: "PAID",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 6 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 4 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 4 },
        ],
      },
      {
        createdAt: daysAgo(55),
        status: "DELIVERED",
        invoiceStatus: "PAID",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 8 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 8 },
        ],
      },
      {
        createdAt: daysAgo(30),
        status: "DELIVERED",
        invoiceStatus: "PAID",
        lines: [
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 10 },
        ],
      },
      {
        createdAt: daysAgo(12),
        status: "SHIPPED",
        invoiceStatus: "PAID",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 4 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 4 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 4 },
        ],
      },
      {
        createdAt: daysAgo(2),
        status: "PENDING",
        invoiceStatus: "NONE",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 2 },
        ],
      },
    ];

    for (const o of demoOrders) {
      const totalOre = o.lines.reduce((s, l) => s + l.priceOre * l.qty, 0);
      const [newOrder] = await db
        .insert(orders)
        .values({
          orgId: clubOrg.id,
          userId: clubAdmin.id,
          status: o.status,
          invoiceStatus: o.invoiceStatus,
          totalOre,
          createdAt: o.createdAt,
          updatedAt: o.createdAt,
        })
        .returning({ id: orders.id });

      await db.insert(orderLines).values(
        o.lines.map((l) => ({
          orderId: newOrder.id,
          productId: l.productId,
          qty: l.qty,
          unitPriceOre: l.priceOre,
        }))
      );
    }
    console.log(`Orders: inserted ${demoOrders.length} demo orders`);
  } else {
    console.log(
      `Orders: ${orderCount?.count ?? 0} already present for club, skipping`
    );
  }

  // ── 6. Quotes (pipeline / quotes-tabellen) ─────────────────────────
  const [quoteCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(quotes)
    .where(
      and(
        eq(quotes.orgId, clubOrg.id),
        eq(quotes.salesRepId, salesRep.id)
      )
    );

  if (Number(quoteCount?.count ?? 0) < 3) {
    const demoQuotes: ReadonlyArray<{
      createdAt: Date;
      validUntil: Date | null;
      status: "DRAFT" | "SENT" | "ACCEPTED";
      lines: ReadonlyArray<{
        productId: string;
        priceOre: number;
        qty: number;
      }>;
    }> = [
      {
        createdAt: daysAgo(45),
        validUntil: daysAgo(-15),
        status: "ACCEPTED",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 10 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 10 },
        ],
      },
      {
        createdAt: daysAgo(14),
        validUntil: daysAgo(-16),
        status: "SENT",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 20 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 10 },
        ],
      },
      {
        createdAt: daysAgo(7),
        validUntil: daysAgo(-23),
        status: "SENT",
        lines: [
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 15 },
        ],
      },
      {
        createdAt: daysAgo(2),
        validUntil: null,
        status: "DRAFT",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 6 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 6 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 6 },
        ],
      },
    ];

    for (const q of demoQuotes) {
      const totalOre = q.lines.reduce((s, l) => s + l.priceOre * l.qty, 0);
      const [newQuote] = await db
        .insert(quotes)
        .values({
          orgId: clubOrg.id,
          salesRepId: salesRep.id,
          status: q.status,
          totalOre,
          validUntil: q.validUntil,
          createdAt: q.createdAt,
          updatedAt: q.createdAt,
        })
        .returning({ id: quotes.id });

      await db.insert(quoteLines).values(
        q.lines.map((l) => ({
          quoteId: newQuote.id,
          productId: l.productId,
          qty: l.qty,
          unitPriceOre: l.priceOre,
        }))
      );
    }
    console.log(`Quotes: inserted ${demoQuotes.length} demo quotes`);
  } else {
    console.log(
      `Quotes: ${quoteCount?.count ?? 0} already present for rep+club, skipping`
    );
  }

  // ── 7. Campaign + team + sellers ───────────────────────────────────
  //   Groundwork for the fundraising portal demo flow. Campaign goal is
  //   sized so that the seeded orders bring it to ~65 % completion.
  const goalSek = 80000;
  const [existingCampaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, "demo-varkampanj-2026"))
    .limit(1);

  const campaign = existingCampaign
    ? existingCampaign
    : (
        await db
          .insert(campaigns)
          .values({
            orgId: clubOrg.id,
            name: "Vårkampanj 2026 (Demo)",
            slug: "demo-varkampanj-2026",
            description: "Insamling till nya tröjor och bortamatcher.",
            story:
              "Demo Fotbollsklubb samlar in pengar för att kunna åka på " +
              "den årliga försäsongsturneringen i Malmö. Varje paket ger " +
              "föreningen 30 % i bidrag.",
            status: "ACTIVE",
            goalType: "AMOUNT",
            goalValue: goalSek,
            startDate: daysAgo(60).toISOString().slice(0, 10),
            endDate: daysAgo(-30).toISOString().slice(0, 10),
            deliveryType: "BULK",
            marginPercent: 30,
          })
          .returning()
      )[0];

  const [existingTeam] = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.orgId, clubOrg.id),
        eq(teams.campaignId, campaign.id),
        eq(teams.name, "Herr A-lag (Demo)")
      )
    )
    .limit(1);

  const team = existingTeam
    ? existingTeam
    : (
        await db
          .insert(teams)
          .values({
            orgId: clubOrg.id,
            campaignId: campaign.id,
            leaderId: clubAdmin.id,
            name: "Herr A-lag (Demo)",
            inviteToken: "demo-team-invite-token",
            memberCount: DEMO_SELLER_USERS.length,
          })
          .returning()
      )[0];

  for (const s of DEMO_SELLER_USERS) {
    const sellerUser = await ensureUser({
      email: s.email,
      passwordHash,
      role: "SELLER",
      orgId: clubOrg.id,
      contactName: s.name,
    });

    const [existingSeller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.shopSlug, s.shopSlug))
      .limit(1);
    if (existingSeller) continue;

    await db.insert(sellers).values({
      userId: sellerUser.id,
      teamId: team.id,
      campaignId: campaign.id,
      shopSlug: s.shopSlug,
      displayName: s.name.split(" ")[0],
      individualGoal: 8000,
      status: "ACTIVE",
    });
  }
  console.log(
    `Campaign: ${campaign.slug} ready (1 team, ${DEMO_SELLER_USERS.length} sellers)`
  );

  // ── 8. Fundraising-portalen (Sprint E1) ────────────────────────────
  //   We seed a *separate* association org so the new portal roles
  //   never collide with the existing CLUB_ADMIN flow on `clubOrg`.
  //   Result: an investor can log in as four distinct surfaces from
  //   the SAME seed:
  //     - klubb@demo.se      (CLUB_ADMIN)        → /portal
  //     - salj@roots.se      (SALES_REP)         → /portal
  //     - admin@roots.se     (INTERNAL_ADMIN)    → /portal
  //     - forening@demo-if.se (ASSOCIATION_ADMIN) → /forening   ← new
  //     - lag@demo-if.se     (TEAM_LEADER)       → /lag         ← new
  //     - noah.saljare@demo-if.se (SELLER)       → /min-shop
  const associationOrg = await ensureOrg({
    name: "Demo IF Sundsvall",
    orgNumber: "556700-1111",
    type: "association",
  });

  const foreningAdmin = await ensureUser({
    email: "forening@demo-if.se",
    passwordHash,
    role: "ASSOCIATION_ADMIN",
    orgId: associationOrg.id,
    contactName: "Karin Lindgren",
  });

  const teamLeader = await ensureUser({
    email: "lag@demo-if.se",
    passwordHash,
    role: "TEAM_LEADER",
    orgId: associationOrg.id,
    contactName: "Mikael Berg",
  });

  // Campaign goal sized so seeded customerOrders bring it to ~55 %.
  const associationGoalSek = 40000;
  const [existingAssocCampaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, "demo-hostkampanj-2026"))
    .limit(1);

  const assocCampaign = existingAssocCampaign
    ? existingAssocCampaign
    : (
        await db
          .insert(campaigns)
          .values({
            orgId: associationOrg.id,
            name: "Höstkampanj 2026 (Demo)",
            slug: "demo-hostkampanj-2026",
            description:
              "Föreningen säljer Roots-paket för att finansiera ungdoms-cup i Helsingborg.",
            story:
              "Demo IF Sundsvall samlar in pengar till en gemensam ungdoms-" +
              "cup. Varje paket ger föreningen 30 % i bidrag — pengarna går " +
              "till resa, boende och matchanmälningar.",
            status: "ACTIVE",
            goalType: "AMOUNT",
            goalValue: associationGoalSek,
            startDate: daysAgo(45).toISOString().slice(0, 10),
            endDate: daysAgo(-45).toISOString().slice(0, 10),
            deliveryType: "BULK",
            marginPercent: 30,
          })
          .returning()
      )[0];

  // The team owned by the TEAM_LEADER. /lag uses
  // `teams.leaderId === session.userId` to find the right team, so we
  // MUST point leaderId at the new teamLeader user (not clubAdmin).
  const ASSOC_TEAM_NAME = "P14 Blå (Demo)";
  const [existingAssocTeam] = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.orgId, associationOrg.id),
        eq(teams.campaignId, assocCampaign.id),
        eq(teams.name, ASSOC_TEAM_NAME)
      )
    )
    .limit(1);

  const assocTeam = existingAssocTeam
    ? existingAssocTeam
    : (
        await db
          .insert(teams)
          .values({
            orgId: associationOrg.id,
            campaignId: assocCampaign.id,
            leaderId: teamLeader.id,
            name: ASSOC_TEAM_NAME,
            inviteToken: "demo-assoc-team-invite",
            memberCount: 3,
          })
          .returning()
      )[0];

  // Three sellers under the association team. Real users so a future
  // demo could even log in as one and walk the /min-shop flow.
  const ASSOC_SELLERS: ReadonlyArray<{
    email: string;
    name: string;
    shopSlug: string;
    individualGoal: number;
  }> = [
    { email: "leo.assoc@demo-if.se", name: "Leo Karlsson", shopSlug: "demo-assoc-leo", individualGoal: 5000 },
    { email: "felicia.assoc@demo-if.se", name: "Felicia Strand", shopSlug: "demo-assoc-felicia", individualGoal: 5000 },
    { email: "william.assoc@demo-if.se", name: "William Holm", shopSlug: "demo-assoc-william", individualGoal: 5000 },
  ];

  const assocSellerRows: { id: string; shopSlug: string }[] = [];
  for (const s of ASSOC_SELLERS) {
    const sellerUser = await ensureUser({
      email: s.email,
      passwordHash,
      role: "SELLER",
      orgId: associationOrg.id,
      contactName: s.name,
    });

    const [existing] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.shopSlug, s.shopSlug))
      .limit(1);
    if (existing) {
      assocSellerRows.push({ id: existing.id, shopSlug: existing.shopSlug });
      continue;
    }

    const [created] = await db
      .insert(sellers)
      .values({
        userId: sellerUser.id,
        teamId: assocTeam.id,
        campaignId: assocCampaign.id,
        shopSlug: s.shopSlug,
        displayName: s.name.split(" ")[0],
        individualGoal: s.individualGoal,
        status: "ACTIVE",
      })
      .returning({ id: sellers.id, shopSlug: sellers.shopSlug });
    assocSellerRows.push(created);
  }

  // Customer orders so /forening + /lag dashboards have real numbers.
  // /dashboard/association reads `customer_orders` (NOT internal orders).
  // We only insert if we don't already have enough rows for this team —
  // re-running the seed should not balloon the dataset.
  const [coCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerOrders)
    .where(eq(customerOrders.teamId, assocTeam.id));

  if (Number(coCountRow?.count ?? 0) < 4) {
    const shampoo = await getRequiredProduct("ROOTS-SH-001");
    const conditioner = await getRequiredProduct("ROOTS-CO-001");
    const bodyWash = await getRequiredProduct("ROOTS-BW-001");

    const fakeCustomers: ReadonlyArray<{
      sellerIndex: number;
      daysAgo: number;
      customerName: string;
      customerEmail: string;
      status: "PAID" | "SHIPPED" | "DELIVERED" | "PENDING";
      lines: ReadonlyArray<{ productId: string; priceOre: number; qty: number }>;
    }> = [
      {
        sellerIndex: 0,
        daysAgo: 30,
        customerName: "Margareta Eriksson",
        customerEmail: "margareta@example.com",
        status: "DELIVERED",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 2 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 2 },
        ],
      },
      {
        sellerIndex: 0,
        daysAgo: 18,
        customerName: "Stig Andersson",
        customerEmail: "stig@example.com",
        status: "DELIVERED",
        lines: [{ productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 3 }],
      },
      {
        sellerIndex: 1,
        daysAgo: 22,
        customerName: "Lena Falk",
        customerEmail: "lena@example.com",
        status: "PAID",
        lines: [
          { productId: shampoo.id, priceOre: shampoo.priceOre, qty: 1 },
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 1 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 1 },
        ],
      },
      {
        sellerIndex: 1,
        daysAgo: 8,
        customerName: "Hans Berg",
        customerEmail: "hans@example.com",
        status: "PAID",
        lines: [{ productId: shampoo.id, priceOre: shampoo.priceOre, qty: 4 }],
      },
      {
        sellerIndex: 2,
        daysAgo: 14,
        customerName: "Birgit Larsson",
        customerEmail: "birgit@example.com",
        status: "SHIPPED",
        lines: [
          { productId: conditioner.id, priceOre: conditioner.priceOre, qty: 2 },
          { productId: bodyWash.id, priceOre: bodyWash.priceOre, qty: 2 },
        ],
      },
      {
        sellerIndex: 2,
        daysAgo: 3,
        customerName: "Ulla Sjöberg",
        customerEmail: "ulla@example.com",
        status: "PAID",
        lines: [{ productId: shampoo.id, priceOre: shampoo.priceOre, qty: 2 }],
      },
    ];

    for (const f of fakeCustomers) {
      const seller = assocSellerRows[f.sellerIndex];
      if (!seller) continue;
      const totalOre = f.lines.reduce((s, l) => s + l.priceOre * l.qty, 0);
      const created = daysAgo(f.daysAgo);
      const [newOrder] = await db
        .insert(customerOrders)
        .values({
          orgId: associationOrg.id,
          campaignId: assocCampaign.id,
          teamId: assocTeam.id,
          sellerId: seller.id,
          customerName: f.customerName,
          customerEmail: f.customerEmail,
          status: f.status,
          totalOre,
          createdAt: created,
          updatedAt: created,
        })
        .returning({ id: customerOrders.id });
      await db.insert(customerOrderLines).values(
        f.lines.map((l) => ({
          orderId: newOrder.id,
          productId: l.productId,
          qty: l.qty,
          unitPriceOre: l.priceOre,
        }))
      );
    }
    console.log(
      `Customer orders: inserted ${fakeCustomers.length} demo orders for ${ASSOC_TEAM_NAME}`
    );
  } else {
    console.log(
      `Customer orders: ${coCountRow?.count ?? 0} already present for ${ASSOC_TEAM_NAME}, skipping`
    );
  }

  console.log(
    `Association: forening=${foreningAdmin.id}, leader=${teamLeader.id}, ` +
      `team=${assocTeam.id}, sellers=${assocSellerRows.length}`
  );

  console.log("Demo seed complete.");
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
