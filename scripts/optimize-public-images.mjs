/**
 * Komprimerar om bilderna i apps/web/public.
 *
 * Bakgrund: originalen låg kvar i nära maxkvalitet — 2400 px breda JPEG:ar på
 * 5–6 MB styck, 82 MB totalt. Next.js bildoptimering ska koda om dem vid
 * första anropet, men att avkoda en 5 MB-källa och koda AVIF i 3840 px tog
 * längre tid än Railways 300-sekundersgräns. Resultatet blev 502 på
 * /_next/image, och eftersom en tung kodning låser containerns CPU ställde sig
 * alla andra bilder i kö bakom den. Därför försvann även logotypen.
 *
 * Åtgärden här är källmaterialet: samma pixelmått, rimlig kvalitet. Taken i
 * next.config.ts (inget 3840, WebP i stället för AVIF) tar resten.
 *
 * Körs manuellt vid behov:
 *   node scripts/optimize-public-images.mjs [--dry]
 */

import { readdir, stat, writeFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * sharp finns redan i pnpm-storen som beroende till Next, men är inte deklarerat
 * åt oss. Att lägga till det som devDependency skulle resolva om hela lockfilen,
 * så vi plockar det ur storen i stället.
 */
async function loadSharp() {
  const store = join(ROOT, "node_modules/.pnpm");
  const dirs = (await readdir(store).catch(() => []))
    .filter((d) => d.startsWith("sharp@"))
    .sort()
    .reverse();
  for (const dir of dirs) {
    // Storen kan innehålla tomma rester efter avinstallerade versioner.
    const mod = await import(
      join(store, dir, "node_modules/sharp/lib/index.js")
    ).catch(() => null);
    if (mod) return mod.default;
  }
  throw new Error(
    "sharp saknas. Kör `pnpm install` i repo-roten och försök igen."
  );
}

const sharp = await loadSharp();
const PUBLIC_DIR = join(ROOT, "apps/web/public");
const DRY = process.argv.includes("--dry");

/**
 * Taken är satta efter hur stort respektive bild någonsin visas, med marginal
 * för skärmar med dubbel pixeltäthet.
 */
const RULES = [
  // Fotografier: behåll måtten, sänk kvaliteten till en nivå där skillnaden
  // inte går att se men filen blir en tiondel.
  { match: /^images\//, maxEdge: 2400, jpegQuality: 82 },
  // Logotyp och symbol visas aldrig bredare än ett par hundra pixlar. De låg
  // i 4000 px, vilket tvingade optimeraren att avkoda 16 megapixel för en
  // bild i sidhuvudet.
  { match: /^brand\/roots-(logo|symbol)-/, maxEdge: 1200 },
  // Gräsdekoren spänner över hela sidbredden men är bara några tiotal pixlar hög.
  { match: /^brand\/roots-element-/, maxEdge: 2000 },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function ruleFor(rel) {
  return RULES.find((r) => r.match.test(rel));
}

const results = [];

for await (const file of walk(PUBLIC_DIR)) {
  const ext = extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;

  const rel = relative(PUBLIC_DIR, file);
  const rule = ruleFor(rel);
  if (!rule) continue;

  const before = (await stat(file)).size;
  const image = sharp(file, { failOn: "none" });
  const meta = await image.metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

  let pipeline = image.rotate(); // bakar in EXIF-orientering innan den slängs
  if (longEdge > rule.maxEdge) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? rule.maxEdge : undefined,
      height: meta.height > meta.width ? rule.maxEdge : undefined,
      withoutEnlargement: true,
    });
  }

  pipeline =
    ext === ".png"
      ? pipeline.png({ compressionLevel: 9, palette: true })
      : pipeline.jpeg({
          quality: rule.jpegQuality ?? 82,
          progressive: true,
          mozjpeg: true,
          chromaSubsampling: "4:2:0",
        });

  const buf = await pipeline.toBuffer();

  // Skriv aldrig en större fil än den som redan ligger där.
  if (buf.length >= before) {
    results.push({ rel, before, after: before, skipped: true });
    continue;
  }
  if (!DRY) await writeFile(file, buf);
  results.push({ rel, before, after: buf.length });
}

const mb = (n) => (n / 1048576).toFixed(2).padStart(6);
let totalBefore = 0;
let totalAfter = 0;

for (const r of results.sort((a, b) => b.before - a.before)) {
  totalBefore += r.before;
  totalAfter += r.after;
  const note = r.skipped ? "  (oförändrad)" : "";
  console.log(`${r.rel.padEnd(34)} ${mb(r.before)} → ${mb(r.after)} MB${note}`);
}

console.log(
  `\n${results.length} filer   ${mb(totalBefore)} → ${mb(totalAfter)} MB` +
    `   (${Math.round((1 - totalAfter / totalBefore) * 100)} % mindre)` +
    (DRY ? "   [torrkörning, inget skrivet]" : "")
);
