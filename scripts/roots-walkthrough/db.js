import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./config.js";

const require = createRequire(
  path.join(ROOT, "../../packages/db/package.json")
);
const postgres = require("postgres");

function railwayVars(service) {
  const raw = execFileSync("railway", ["variables", "-s", service, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed = JSON.parse(raw);
  return parsed?.data || parsed?.variables || parsed;
}

export function databaseUrl() {
  if (process.env.DATABASE_PUBLIC_URL) return process.env.DATABASE_PUBLIC_URL;
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes(".railway.internal")
  ) {
    return process.env.DATABASE_URL;
  }
  let fallback = "";
  for (const service of ["Postgres", "postgres", "roots"]) {
    try {
      const vars = railwayVars(service);
      if (vars.DATABASE_PUBLIC_URL) return vars.DATABASE_PUBLIC_URL;
      if (
        vars.DATABASE_URL &&
        !String(vars.DATABASE_URL).includes(".railway.internal")
      ) {
        fallback = vars.DATABASE_URL;
      }
    } catch {
      /* ignore */
    }
  }
  if (fallback) return fallback;
  throw new Error("Saknar publik DATABASE_URL.");
}

export function openDb() {
  return postgres(databaseUrl(), {
    ssl: "require",
    max: 1,
    connect_timeout: 20,
  });
}
