import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Walk up from cwd until we find the monorepo root.
 * Cursor starts at the repo. The API often starts in `apps/api`.
 */
export function repoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      existsSync(path.join(dir, ".cursor", "orchestrator"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}
