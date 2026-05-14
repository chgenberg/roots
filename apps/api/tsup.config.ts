import { defineConfig } from "tsup";

/**
 * Single source of truth for the API + worker bundle.
 *
 * Both entries are needed in production:
 *  - dist/index.js          → API HTTP server (default Dockerfile CMD)
 *  - dist/workers/index.js  → pg-boss worker pool (separate process / service)
 *
 * Output is CJS so the existing Dockerfile's `node dist/index.js` keeps
 * working without forcing a `"type": "module"` flip on the workspace.
 *
 * `package.json` scripts intentionally invoke `tsup` *without* CLI flags so
 * this file is the only place the build is configured.
 */
export default defineConfig({
  entry: ["src/index.ts", "src/workers/index.ts"],
  format: ["cjs"],
  noExternal: ["@roots/db", "@roots/contracts"],
  clean: true,
  // No d.ts — production bundles don't need them and skipping shaves ~40s
  // off the cold build in CI. `pnpm typecheck` already covers type safety.
  dts: false,
  sourcemap: false,
  target: "es2022",
});
