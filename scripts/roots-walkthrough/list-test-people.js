/**
 * Readonly-lista av testkonton i prod. Skriver inget.
 * Inga lösen eller anslutningssträngar i utskriften.
 */
import { openDb } from "./db.js";

const TEST_ORG_NAMES = [
  "Roots FBK",
  "Demo Fotbollsklubb",
  "Demo IF Sundsvall",
];

async function main() {
  const sql = openDb();
  try {
    const users = await sql`
      SELECT u.email, u.role, u.contact_name, o.name AS org_name, o.verified
      FROM users u
      LEFT JOIN organizations o ON o.id = u.org_id
      WHERE
        u.email LIKE '%@film.roots.nu'
        OR u.email LIKE 'walk.%@roots.nu'
        OR u.email LIKE '%@demo.se'
        OR u.email LIKE '%@demo-if.se'
        OR o.name = ANY(${TEST_ORG_NAMES})
      ORDER BY u.role, u.email
    `;

    const orgs = await sql`
      SELECT name, type, verified, org_number
      FROM organizations
      WHERE name = ANY(${TEST_ORG_NAMES})
      ORDER BY name
    `;

    const blocked = users.filter(
      (u) =>
        u.email === "admin@roots.se" ||
        u.email === "salj@roots.se"
    );

    console.log("ORGS");
    if (orgs.length === 0) console.log("  (inga)");
    for (const o of orgs) {
      console.log(
        `  ${o.name}  type=${o.type}  verified=${o.verified}  orgnr=${o.org_number || "-"}`
      );
    }

    console.log("USERS");
    if (users.length === 0) console.log("  (inga)");
    for (const u of users) {
      console.log(
        `  ${u.role.padEnd(18)} ${u.email}  ${u.contact_name || "-"}  org=${u.org_name || "-"}  verified=${u.verified ?? "-"}`
      );
    }

    if (blocked.length) {
      console.log("STOP  admin@roots.se eller salj@roots.se matchade. Inget skrivs.");
      process.exit(2);
    }

    console.log(`OK  ${users.length} users  ${orgs.length} orgs`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
