/**
 * Kontrollerar en uppsättning env-variabler mot produktionsreglerna INNAN
 * en deploy.
 *
 * Varför: `validateEnvOrExit()` körs vid uppstart och avslutar processen på
 * varje konflikt. Det är rätt beteende — en felkonfigurerad instans ska inte
 * ta trafik — men det betyder också att man upptäcker problemet som en
 * omstartsloop i produktion i stället för före deployen. Kontrollerna för
 * hemlighetslängd, dubbletter och CORS-matchning är dessutom nya, så en miljö
 * som fungerat i månader kan mycket väl falla på dem första gången.
 *
 * Skriptet skriver aldrig ut värden, bara variabelnamn och vad som är fel.
 *
 * Användning:
 *
 *   # Mot en fil med produktionsvariablerna (railway variables > fil)
 *   pnpm --filter @roots/api env:check /tmp/prod.env
 *   pnpm --filter @roots/api env:check -- --file /tmp/prod.env
 *
 *   # Eller mot det som redan finns i skalet
 *   pnpm --filter @roots/api env:check
 */

import { existsSync, readFileSync } from "node:fs";
import { checkEnv } from "../lib/validate-env";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Railways export-format citerar värden; behåll dem inte i jämförelsen,
    // annars ser ett 32-teckens secret ut som 34 och slinker igenom.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  let file = fileIdx >= 0 ? args[fileIdx + 1] : null;

  if (fileIdx >= 0 && !file) {
    console.error("--file kräver en sökväg.");
    process.exit(2);
  }

  // En naken sökväg duger också. Att bara ignorera den vore det värsta
  // utfallet: kontrollen körs mot skalet, allt ser bra ut, och man tror att
  // man granskat produktionsfilen.
  if (!file) {
    const stray = args.filter((a) => !a.startsWith("-"));
    if (stray.length === 1) {
      file = stray[0];
    } else if (stray.length > 1) {
      console.error(
        `Förstod inte argumenten: ${stray.join(" ")}. Ange en enda fil, eller inga för att kontrollera skalet.`
      );
      process.exit(2);
    }
  }

  if (file && !existsSync(file)) {
    console.error(
      `Hittar inte ${file}. Kontrollen avbryts hellre än att tysta falla tillbaka på skalets variabler.`
    );
    process.exit(2);
  }

  let env: NodeJS.ProcessEnv;
  if (file) {
    // Bara filens innehåll, inte skalets. Att blanda in det lokala skalet
    // skulle kunna dölja att en variabel saknas i Railway.
    env = { ...parseEnvFile(file), NODE_ENV: "production" };
    console.log(`Kontrollerar ${file} mot produktionsreglerna.\n`);
  } else {
    env = { ...process.env, NODE_ENV: "production" };
    console.log("Kontrollerar skalets variabler mot produktionsreglerna.\n");
  }

  const report = checkEnv(env, true);

  const sections: Array<[string, string[], boolean]> = [
    ["Saknas helt", report.missing, true],
    ["Ser ut som platshållare", report.placeholders, true],
    ["Krävs av en annan variabel", report.conditionalMissing, true],
    ["Konflikter", report.conflicts, true],
    ["Rekommenderade som saknas", report.recommendedMissing, false],
  ];

  for (const [title, items, blocking] of sections) {
    if (items.length === 0) continue;
    console.log(`${blocking ? "✗" : "–"} ${title}:`);
    for (const item of items) console.log(`    ${item}`);
    console.log();
  }

  if (report.ok) {
    console.log(
      report.recommendedMissing.length
        ? "Inget som stoppar uppstarten. De rekommenderade ovan stänger av funktioner, men API:t startar."
        : "Allt ser bra ut. API:t startar med de här variablerna."
    );
    return;
  }

  console.error(
    "API:t skulle vägra starta med de här variablerna. Rätta punkterna ovan i " +
      "Railway innan du deployar — annars hamnar tjänsten i en omstartsloop."
  );
  process.exit(1);
}

main();
