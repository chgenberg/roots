/**
 * Godkänner enbart den lokalt sparade filmföreningen (organizations.verified).
 * Används när FILM_INTERNAL_* saknas så kampanj/shop kan spelas in.
 * Skriver aldrig ut anslutningssträng eller e-post.
 */
import fs from "node:fs";
import { statePath } from "./config.js";
import { openDb } from "./db.js";

async function main() {
  const state = JSON.parse(fs.readFileSync(statePath("sv"), "utf8"));
  if (!state?.orgName) throw new Error("Saknar orgName i state.json");

  const sql = openDb();
  try {
    const rows = await sql`
      UPDATE organizations
      SET verified = true,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE name = ${state.orgName}
      RETURNING id, verified
    `;
    if (rows.length === 0) {
      throw new Error(`Ingen organisation matchade namnet i state.json`);
    }
    console.log(`Godkände ${rows.length} filmförening (verified=${rows[0].verified}).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
