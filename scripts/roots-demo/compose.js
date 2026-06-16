// Steg 3 — ffmpeg-komposition. Ett enda filter_complex:
//   trimma+rampa varje segment → concat → overlay på telefonramen →
//   korsfada in/ut intro/outro → encode.
//
//   node compose.js <role> [locale] [variant]
//
// Skriver:  out/<role>/<locale>/<variant>/<role>-demo.mp4  (+ poster.jpg)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  ROLES,
  ROLE_KEYS,
  DEFAULT_LOCALE,
  geom,
  recordDir,
  variantDir,
} from "./config.js";
import { buildSegments } from "./segments.js";

const role = (process.argv[2] || "seller").toLowerCase();
const locale = (process.argv[3] || DEFAULT_LOCALE).toLowerCase();
const variant = (process.argv[4] || "desktop").toLowerCase();

if (!ROLE_KEYS.includes(role)) {
  console.error(`Okänd roll "${role}". Välj: ${ROLE_KEYS.join(", ")}`);
  process.exit(1);
}

const cfg = ROLES[role];
const G = geom(variant);
const REC = recordDir(role, locale);
const DIR = variantDir(role, locale, variant);

const RAW = path.join(REC, "raw.webm");
const MARKS = path.join(REC, "marks.json");
const BG = path.join(DIR, "bg.png");
const FRAME = path.join(DIR, "frame.png");
const INTRO = path.join(DIR, "intro.png");
const OUTRO = path.join(DIR, "outro.png");
const OUT = path.join(DIR, `${role}-demo.mp4`);
const POSTER = path.join(DIR, "poster.jpg");

for (const f of [RAW, MARKS, BG, FRAME, INTRO, OUTRO]) {
  if (!fs.existsSync(f)) {
    console.error(`Saknar ${f}. Kör record.js + frames.js först.`);
    process.exit(1);
  }
}

const INTRO_DUR = 1.6;
const OUTRO_DUR = 1.9;
const FADE = 0.5;

function ffprobeDuration(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    file,
  ]).toString().trim();
  return parseFloat(out);
}

function main() {
  const { marks } = JSON.parse(fs.readFileSync(MARKS, "utf8"));
  const videoDur = ffprobeDuration(RAW);
  const { segs, bodyDur } = buildSegments(role, marks, videoDur);

  if (!segs.length) {
    console.error("Inga segment kunde byggas (saknade markörer?).");
    process.exit(1);
  }

  console.log(`\n🎞  Komponerar: ${cfg.label} (${role}/${locale}/${variant})`);
  console.log(`   raw=${videoDur.toFixed(1)}s · ${segs.length} segment · body=${bodyDur.toFixed(1)}s`);

  // ── filter_complex ─────────────────────────────────────────────────
  const parts = [];
  segs.forEach((s, i) => {
    parts.push(
      `[0:v]trim=start=${s.a}:end=${s.b},setpts=(PTS-STARTPTS)/${s.speed}[s${i}]`
    );
  });
  const concatIn = segs.map((_, i) => `[s${i}]`).join("");
  parts.push(`${concatIn}concat=n=${segs.length}:v=1:a=0[cat]`);
  parts.push(
    `[cat]fps=30,scale=${G.screenW}:${G.screenH}:flags=lanczos,setsar=1[body]`
  );

  parts.push(`[1:v]scale=${G.canvas.w}:${G.canvas.h},setsar=1,fps=30[bg]`);
  parts.push(`[2:v]scale=${G.canvas.w}:${G.canvas.h},setsar=1,fps=30[frm]`);
  parts.push(`[bg][body]overlay=${G.screenX}:${G.screenY}:shortest=1[c1]`);
  parts.push(`[c1][frm]overlay=0:0:shortest=1,format=yuv420p[main]`);

  parts.push(`[3:v]scale=${G.canvas.w}:${G.canvas.h},setsar=1,fps=30,format=yuv420p[intro]`);
  parts.push(`[4:v]scale=${G.canvas.w}:${G.canvas.h},setsar=1,fps=30,format=yuv420p[outro]`);

  const off1 = (INTRO_DUR - FADE).toFixed(3);
  parts.push(
    `[intro][main]xfade=transition=fade:duration=${FADE}:offset=${off1}[m1]`
  );
  const off2 = (INTRO_DUR + bodyDur - FADE - FADE).toFixed(3);
  parts.push(
    `[m1][outro]xfade=transition=fade:duration=${FADE}:offset=${off2}[vout]`
  );

  const filter = parts.join(";");

  const args = [
    "-y",
    "-i", RAW,
    "-loop", "1", "-i", BG,
    "-loop", "1", "-i", FRAME,
    "-loop", "1", "-t", String(INTRO_DUR), "-i", INTRO,
    "-loop", "1", "-t", String(OUTRO_DUR), "-i", OUTRO,
    "-filter_complex", filter,
    "-map", "[vout]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "21",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    OUT,
  ];

  execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`  ✅ ${OUT}`);

  // Poster en bit in i filmen (strax efter introt).
  execFileSync("ffmpeg", [
    "-y",
    "-ss", String(INTRO_DUR + 0.8),
    "-i", OUT,
    "-frames:v", "1",
    "-q:v", "3",
    POSTER,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`  ✅ ${POSTER}\n`);
}

main();
