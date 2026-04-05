import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  noExternal: ["@roots/db", "@roots/contracts"],
  clean: true,
});
