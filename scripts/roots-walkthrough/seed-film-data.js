/**
 * Fyller filmföreningen Roots FBK med PAID-ordrar så grafer och KPI:er
 * syns. Rör bara rader märkta @film.roots.nu.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { statePath } from "./config.js";
import { openDb } from "./db.js";

const BUYERS = [
  "Karin Holm",
  "Per Nyström",
  "Lisa Berg",
  "Johan Ek",
  "Eva Lund",
  "Anders Holmgren",
  "Sofia Dahl",
  "Nils Åberg",
];

async function main() {
  const state = JSON.parse(fs.readFileSync(statePath("sv"), "utf8"));
  const sql = openDb();
  try {
    const [org] = await sql`
      SELECT id FROM organizations WHERE name = ${state.orgName} LIMIT 1
    `;
    if (!org) throw new Error("Hittar inte filmföreningen");

    const [campaign] = await sql`
      SELECT id FROM campaigns WHERE org_id = ${org.id} ORDER BY created_at DESC LIMIT 1
    `;
    const [team] = await sql`
      SELECT id FROM teams WHERE org_id = ${org.id} ORDER BY created_at DESC LIMIT 1
    `;
    const [seller] = await sql`
      SELECT id FROM sellers WHERE team_id = ${team?.id || null} LIMIT 1
    `;
    if (!campaign || !team || !seller) {
      throw new Error("Saknar kampanj, lag eller säljare");
    }

    const linked = await sql`
      SELECT p.id, p.price_ore
      FROM products p
      JOIN campaign_products cp ON cp.product_id = p.id
      WHERE cp.campaign_id = ${campaign.id}
        AND cp.active = true
        AND p.active = true
      ORDER BY p.price_ore ASC
      LIMIT 4
    `;
    let products = [...linked];
    if (products.length === 0) {
      const catalog = await sql`
        SELECT id, price_ore FROM products WHERE active = true ORDER BY price_ore ASC LIMIT 4
      `;
      for (let i = 0; i < catalog.length; i++) {
        await sql`
          INSERT INTO campaign_products (campaign_id, product_id, sort_order, active)
          VALUES (${campaign.id}, ${catalog[i].id}, ${i}, true)
          ON CONFLICT (campaign_id, product_id) DO NOTHING
        `;
      }
      products = catalog;
    }
    const product = products[0];
    if (!product) throw new Error("Saknar produkt att sälja");

    await sql`
      UPDATE campaigns
      SET start_date = CURRENT_DATE - 18,
          end_date = CURRENT_DATE + 12,
          goal_value = 50000,
          status = 'ACTIVE',
          margin_percent = 35,
          updated_at = NOW()
      WHERE id = ${campaign.id}
    `;

    await sql`
      UPDATE sellers SET individual_goal = 12000, updated_at = NOW()
      WHERE id = ${seller.id}
    `;

    const existingGoal = await sql`
      SELECT id FROM team_goals
      WHERE team_id = ${team.id} AND campaign_id = ${campaign.id}
      LIMIT 1
    `;
    if (existingGoal.length) {
      await sql`
        UPDATE team_goals SET goal_value = 18000 WHERE id = ${existingGoal[0].id}
      `;
    } else {
      await sql`
        INSERT INTO team_goals (team_id, campaign_id, goal_type, goal_value)
        VALUES (${team.id}, ${campaign.id}, 'AMOUNT', 18000)
      `;
    }

    await sql`
      DELETE FROM customer_order_lines
      WHERE order_id IN (
        SELECT id FROM customer_orders
        WHERE org_id = ${org.id} AND customer_email LIKE '%@film.roots.nu'
      )
    `;
    await sql`
      DELETE FROM customer_orders
      WHERE org_id = ${org.id} AND customer_email LIKE '%@film.roots.nu'
    `;

    const qtys = [1, 2, 1, 3, 2, 1, 2, 1, 2, 3, 1, 2, 1, 2, 1, 2, 1, 2, 3, 1];
    let inserted = 0;
    for (let i = 0; i < qtys.length; i++) {
      const qty = qtys[i];
      const sku = products[i % products.length];
      const total = qty * sku.price_ore;
      const daysAgo = 17 - Math.floor((i * 17) / qtys.length);
      const created = new Date(Date.now() - daysAgo * 86400000);
      const buyer = BUYERS[i % BUYERS.length];
      const orderId = randomUUID();
      await sql`
        INSERT INTO customer_orders (
          id, org_id, campaign_id, team_id, seller_id,
          customer_name, customer_email, customer_phone,
          delivery_type, payment_method, selected_payment_method,
          status, total_ore, shipping_ore, counts_toward_stats,
          is_manual, margin_percent_at_sale, verified_at,
          created_at, updated_at
        ) VALUES (
          ${orderId}, ${org.id}, ${campaign.id}, ${team.id}, ${seller.id},
          ${buyer}, ${`kund.${i}@film.roots.nu`}, ${"0701234567"},
          'BULK', 'STRIPE', 'card',
          'PAID', ${total}, 0, true,
          ${i % 5 === 0}, 35, ${created},
          ${created}, ${created}
        )
      `;
      await sql`
        INSERT INTO customer_order_lines (order_id, product_id, qty, unit_price_ore)
        VALUES (${orderId}, ${sku.id}, ${qty}, ${sku.price_ore})
      `;
      inserted += 1;
    }

    console.log(`Seedade ${inserted} ordrar för filmföreningen.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
