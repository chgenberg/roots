import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CHAPTERS, VIEWPORT, chapterDir } from "./config.js";

const locale = process.argv[2] || "sv";

function previewGateTrim(dir) {
  const marksPath = path.join(dir, "marks.json");
  if (!fs.existsSync(marksPath)) return 0;
  const { marks } = JSON.parse(fs.readFileSync(marksPath, "utf8"));
  const firstTitle = (marks || []).find((m) =>
    String(m.name).startsWith("title:")
  );
  if (!firstTitle || typeof firstTitle.t !== "number") return 0;
  if (firstTitle.t < 3) return 0;
  return Math.max(0, Number(firstTitle.t.toFixed(3)));
}

function composeChapter(chapter) {
  const dir = chapterDir(chapter.id, locale);
  const raw = path.join(dir, "raw.webm");
  const title = path.join(dir, "title.png");
  const out = path.join(dir, `${chapter.file}.mp4`);

  if (!fs.existsSync(raw)) {
    console.warn(`  hoppar ${chapter.id} — saknar raw.webm`);
    return null;
  }
  if (!fs.existsSync(title)) {
    throw new Error(`Saknar ${title} — kör node titles.js först`);
  }

  const trim = previewGateTrim(dir);
  const rawInput = trim > 0.2 ? ["-ss", String(trim), "-i", raw] : ["-i", raw];

  const filter = [
    `[0:v]scale=${VIEWPORT.w}:${VIEWPORT.h},setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=1.35:d=0.3[t]`,
    `[1:v]fps=30,scale=${VIEWPORT.w}:${VIEWPORT.h}:force_original_aspect_ratio=decrease,pad=${VIEWPORT.w}:${VIEWPORT.h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.35[v]`,
    `[t][v]concat=n=2:v=1:a=0[out]`,
  ].join(";");

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-t",
      "1.7",
      "-i",
      title,
      ...rawInput,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  console.log(
    `  ${chapter.file}.mp4${trim > 0.2 ? `  (preview-grind −${trim.toFixed(1)}s)` : ""}`
  );
  return out;
}

function main() {
  const only = process.argv[3];
  const list = only
    ? CHAPTERS.filter((c) => c.id === only.padStart(2, "0") || c.key === only)
    : CHAPTERS;
  console.log("\nKomponerar kapitel…");
  for (const chapter of list) composeChapter(chapter);
  console.log("");
}

main();
