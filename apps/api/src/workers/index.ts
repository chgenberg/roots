import { flags } from "../lib/flags";
import { childLogger } from "../lib/logger";
import { runBootMigrations } from "../lib/migrate-on-boot";
import {
  registerJobHandler,
  startWorkers,
  stopWorkers,
  type JobContext,
  type JobName,
} from "../lib/jobs";
import { runOrganizationNormalize } from "../lib/ai/agents/org-normalizer";

/**
 * Standalone worker process entrypoint.
 *
 * Run with:
 *   WORKERS_ENABLED=true node dist/workers/index.js
 *
 * The API server (`src/index.ts`) does **not** start workers. Operations
 * should scale workers independently from the request-handling fleet.
 *
 * Some handlers (`agent.organization-normalize`) ship with a deterministic
 * v1 implementation; the rest are no-op placeholders that log payloads so
 * the queue is reachable and singleton-keys stay deduplicated.
 */
const log = childLogger("workers");

function noopHandler<N extends JobName>(ctx: JobContext<N>): void {
  log.info({ name: ctx.name, payload: ctx.payload }, "job received (no-op)");
}

async function main(): Promise<void> {
  if (!flags.workersEnabled()) {
    log.warn("WORKERS_ENABLED is not truthy — exiting");
    process.exit(0);
  }

  // Recommended: let the API container own migrations and set this off in
  // worker env. Honouring the flag here means a worker-only deploy still
  // works (and the advisory lock prevents races with the API).
  await runBootMigrations();

  // Real handler.
  registerJobHandler("agent.organization-normalize", async ({ payload }) => {
    await runOrganizationNormalize(payload);
  });

  // Placeholders — replaced in follow-up PRs per agent (plan 04/02–06).
  const placeholderJobs: JobName[] = [
    "agent.segment-normalize",
    "agent.lead-score-refresh",
    "agent.duplicate-sweep",
    "agent.member-estimate-refresh",
    "agent.playbook-embed-reindex",
    "system.audit-log-archive",
  ];
  for (const name of placeholderJobs) registerJobHandler(name, noopHandler);

  await startWorkers();
  log.info(
    {
      real: ["agent.organization-normalize"],
      placeholder: placeholderJobs,
    },
    "workers ready"
  );

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down workers");
    await stopWorkers();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.error({ err }, "worker bootstrap failed");
  process.exit(1);
});
