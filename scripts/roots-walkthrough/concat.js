import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CHAPTERS, chapterDir, outDir } from "./config.js";

const locale = process.argv[2] || "sv";

function main() {
  const files = [];
  for (const chapter of CHAPTERS) {
    const p = path.join(chapterDir(chapter.id, locale), `${chapter.file}.mp4`);
    if (fs.existsSync(p)) files.push(p);
    else console.warn(`  saknar ${chapter.file}.mp4`);
  }
  if (files.length === 0) {
    throw new Error("Inga kapitel-mp4 att limma. Kör compose.js först.");
  }

  const listPath = path.join(outDir(locale), "concat.txt");
  fs.writeFileSync(
    listPath,
    files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n")
  );

  const dest = path.join(outDir(locale), "walkthrough-forening.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      dest,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  console.log(`\nKlar: ${dest}\n`);
}

main();
