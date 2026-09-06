import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SHIPPED_MEMORY } from "./memory-shipped";
import { repoRoot } from "./root";

const CURSOR_DIR = ".cursor/orchestrator";
const SHIPPED_MEMORY_REL = "apps/api/src/lib/orchestrator/MEMORY.md";

export function cursorOrchestratorDir(root = repoRoot()): string {
  return path.join(root, CURSOR_DIR);
}

export function memoryFile(root = repoRoot()): string {
  return path.join(root, CURSOR_DIR, "MEMORY.md");
}

export function shippedMemoryFile(root = repoRoot()): string {
  return path.join(root, SHIPPED_MEMORY_REL);
}

export function dailyNoteFile(isoDate: string, root = repoRoot()): string {
  return path.join(root, CURSOR_DIR, "memory", `${isoDate}.md`);
}

export function todayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayStamp(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function readUtf8(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function readMemory(root = repoRoot()): Promise<{
  body: string;
  source: "cursor" | "shipped" | "empty";
}> {
  const cursor = (await readUtf8(memoryFile(root))).trim();
  if (cursor) return { body: cursor, source: "cursor" };
  const shipped = (await readUtf8(shippedMemoryFile(root))).trim();
  if (shipped) return { body: shipped, source: "shipped" };
  const bundled = SHIPPED_MEMORY.trim();
  if (bundled) return { body: bundled, source: "shipped" };
  return { body: "", source: "empty" };
}

export async function readDaily(
  isoDate: string,
  root = repoRoot()
): Promise<string> {
  return readUtf8(dailyNoteFile(isoDate, root));
}

export async function appendDaily(
  line: string,
  now = new Date(),
  root = repoRoot()
): Promise<void> {
  const file = dailyNoteFile(todayStamp(now), root);
  await mkdir(path.dirname(file), { recursive: true });
  const exists = (await readUtf8(file)).length > 0;
  const prefix = exists ? "" : `# ${todayStamp(now)}\n\n`;
  await appendFile(file, `${prefix}- ${line.trim()}\n`, "utf8");
}

export async function promoteToMemory(
  paragraph: string,
  root = repoRoot()
): Promise<void> {
  const file = memoryFile(root);
  await mkdir(path.dirname(file), { recursive: true });
  const current = await readUtf8(file);
  const block = `\n${paragraph.trim()}\n`;
  if (current.includes(paragraph.trim())) return;
  if (current) {
    await appendFile(file, block, "utf8");
    return;
  }
  await writeFile(file, `# MEMORY\n${block}`, "utf8");
}

export function excerptMemory(body: string, maxChars = 900): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
}
