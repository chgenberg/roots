/**
 * Städar luckor efter personkörningen. Kräver --apply för skrivning.
 * Rör bara film-/walk-rader. Klickar inte PAID och skickar inte Fortnox.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { ROOT } from "./config.js";
import { openDb } from "./db.js";
import { saveState } from "./state.js";

const require = createRequire(
  path.join(ROOT, "../../packages/db/package.json")
);
const { hash } = require("@node-rs/argon2");

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const BUYER_EMAIL = "karin.holm@film.roots.nu";
const PAID_KEEP = "f43966fc-bb14-4108-a765-fcbfc3eab5c7";
const INTERN = {
  email: "walk.intern.mt7s7hmq@roots.nu",
  name: "Walk Intern",
};
const BLOCKED = new Set(["admin@roots.se", "salj@roots.se"]);

async function main() {
  const apply = process.argv.includes("--apply");
  const password = process.env.FILM_PASSWORD?.trim();
  if (apply && !password) {
    throw new Error("FILM_PASSWORD måste vara satt för --apply.");
  }

  const sql = openDb();
  try {
    const orders = await sql`
      SELECT id, status, total_ore, customer_email, customer_name
      FROM customer_orders
      WHERE customer_email = ${BUYER_EMAIL}
      ORDER BY created_at DESC
    `;
    console.log("KARIN-ORDRAR");
    for (const o of orders) {
      console.log(`  ${o.status} ${o.id} ${o.total_ore} ${o.customer_name}`);
    }

    const pending = orders.filter(
      (o) => o.status === "PENDING" && o.id !== PAID_KEEP
    );
    const paid = orders.filter((o) => o.status === "PAID");
    if (paid.length === 0) {
      throw new Error("Hittar ingen PAID Karin-order. Avbrutet.");
    }

    const [campaign] = await sql`
      SELECT c.id, c.name, c.status
      FROM campaigns c
      JOIN organizations o ON o.id = c.org_id
      WHERE o.name = 'Roots FBK'
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    if (!campaign) throw new Error("Hittar inte Roots FBK-kampanj.");
    console.log(`KAMPANJ ${campaign.status} ${campaign.name}`);

    const [payout] = await sql`
      SELECT p.id, p.status, p.total_sales_ore
      FROM payouts p
      JOIN organizations o ON o.id = p.org_id
      WHERE o.name = 'Roots FBK'
      ORDER BY p.created_at DESC
      LIMIT 1
    `;
    if (payout) {
      console.log(`PAYOUT ${payout.status} ${payout.total_sales_ore}`);
      if (payout.status === "PAID") {
        throw new Error("Utbetalning är PAID. Avbrutet.");
      }
    }

    const cards = await sql`
      SELECT key, title, status, gate
      FROM orchestrator_cards
      WHERE source = 'admin'
      ORDER BY created_at DESC
      LIMIT 12
    `.catch(() => []);
    console.log(`TAVLA ${cards.length} admin-kort`);
    for (const card of cards.slice(0, 5)) {
      console.log(`  ${card.status} ${card.gate} ${card.title}`);
    }

    if (!apply) {
      console.log(
        `Torrkörning. Skulle ta bort ${pending.length} PENDING och sätta kampanj ACTIVE.`
      );
      return;
    }

    if (pending.length) {
      const ids = pending.map((o) => o.id);
      await sql`
        DELETE FROM customer_order_lines
        WHERE order_id = ANY(${ids})
      `;
      const deleted = await sql`
        DELETE FROM customer_orders
        WHERE id = ANY(${ids})
          AND status = 'PENDING'
          AND customer_email LIKE '%@film.roots.nu'
          AND id <> ${PAID_KEEP}
        RETURNING id
      `;
      console.log(`Tog bort ${deleted.length} PENDING-kassor.`);
    } else {
      console.log("Inga PENDING-kassor att ta bort.");
    }

    await sql`
      UPDATE campaigns
      SET status = 'ACTIVE',
          start_date = CURRENT_DATE - 18,
          end_date = CURRENT_DATE + 12,
          updated_at = NOW()
      WHERE id = ${campaign.id}
    `;
    console.log("Kampanj satt till ACTIVE.");

    const [org] = await sql`
      SELECT id FROM organizations WHERE name = 'Roots FBK' LIMIT 1
    `;
    if (!org) throw new Error("Hittar inte Roots FBK.");

    if (BLOCKED.has(INTERN.email)) {
      throw new Error("Intern-mejlet är spärrat.");
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);
    const [intern] = await sql`
      SELECT id, email, role FROM users WHERE email = ${INTERN.email} LIMIT 1
    `;
    if (intern) {
      if (intern.role !== "INTERNAL_ADMIN") {
        throw new Error("Befintlig intern har fel roll. Avbrutet.");
      }
      await sql`
        UPDATE users
        SET password_hash = ${passwordHash},
            contact_name = ${INTERN.name},
            org_id = ${org.id},
            mfa_secret = NULL,
            mfa_enabled_at = NULL,
            mfa_backup_codes = NULL,
            updated_at = NOW()
        WHERE id = ${intern.id}
          AND email = ${INTERN.email}
          AND role = 'INTERNAL_ADMIN'
      `;
      console.log("Uppdaterade test-intern.");
    } else {
      await sql`
        INSERT INTO users (email, password_hash, role, org_id, contact_name)
        VALUES (
          ${INTERN.email},
          ${passwordHash},
          'INTERNAL_ADMIN',
          ${org.id},
          ${INTERN.name}
        )
      `;
      console.log("Skapade test-intern.");
    }

    saveState({ internEmail: INTERN.email, internName: INTERN.name });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
