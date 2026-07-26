#!/usr/bin/env node
/**
 * Kontrollerar att varje statisk fil som webbappen refererar till faktiskt
 * ligger i apps/web/public.
 *
 * Bakgrund: /demo/seller.mp4 raderades av misstag i en commit som handlade
 * om produktbilder. Inget typfel, inget testfel, ingen byggvarning — filmen
 * blev bara en 404 på /sa-fungerar-det i produktion. Next serverar public/
 * rakt av, så ingen del av verktygskedjan känner till dessa sökvägar.
 *
 * Vi matchar bara strängliteraler, vilket räcker: alla nuvarande referenser
 * (inklusive bildkartan i lib/product-catalog.ts) är literaler.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web");
const srcDir = join(webRoot, "src");
const publicDir = join(webRoot, "public");

const REF = /["'](\/(?:images|demo|brand|videos)\/[A-Za-z0-9._/-]+)["']/g;
const CODE = /\.(?:tsx?|jsx?|mjs|css)$/;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return CODE.test(entry) ? [path] : [];
  });
}

const missing = new Map();
let refCount = 0;

for (const file of walk(srcDir)) {
  const text = readFileSync(file, "utf8");
  for (const [, ref] of text.matchAll(REF)) {
    refCount += 1;
    if (existsSync(join(publicDir, ref))) continue;
    const where = missing.get(ref) ?? new Set();
    where.add(file.slice(webRoot.length + 1));
    missing.set(ref, where);
  }
}

if (missing.size > 0) {
  console.error(`✗ ${missing.size} refererade filer saknas i apps/web/public:\n`);
  for (const [ref, files] of missing) {
    console.error(`  ${ref}`);
    for (const file of files) console.error(`      ← ${file}`);
  }
  process.exit(1);
}

console.log(`✓ alla ${refCount} refererade statiska filer finns`);
