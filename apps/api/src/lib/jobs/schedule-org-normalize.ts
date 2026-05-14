import { childLogger } from "../logger";
import { flags } from "../flags";
import { enqueueJob, singletonKey } from "./index";

const log = childLogger("jobs.schedule");

/**
 * Fire-and-forget enqueue of the organisation-normalizer agent for a newly
 * created org.
 *
 * Production behaviour:
 *  - Returns immediately. Caller must NOT await this. The function is
 *    intentionally synchronous and discards the underlying promise.
 *  - Bypassed entirely when `flags.workersEnabled()` is false (no enqueue
 *    side-effect, no log noise).
 *  - Errors from the queue layer are caught and logged as `warn`. The caller's
 *    HTTP response is **never** affected by queue failures.
 *  - Deduplicated per `orgId` via pg-boss `singletonKey`, so repeat triggers
 *    (e.g. admin "re-normalize" button) collapse to a single job.
 *
 * **IMPORTANT — transaction safety.** Call this **after** the transaction
 * that inserts the organisation row has committed. pg-boss runs on a separate
 * connection and cannot participate in the caller's Drizzle transaction. If
 * the tx rolls back after enqueue, the worker would race against a non-
 * existent row (the handler is defensive and logs "skip-missing", but the
 * warning is avoidable).
 */
export function scheduleOrgNormalize(orgId: string): void {
  if (!flags.workersEnabled()) return;
  void enqueueJob(
    "agent.organization-normalize",
    { organizationId: orgId },
    {
      singletonKey: singletonKey("agent.organization-normalize", { orgId }),
    }
  ).catch((err: unknown) => {
    log.warn(
      { err, orgId },
      "failed to enqueue agent.organization-normalize (non-fatal)"
    );
  });
}
