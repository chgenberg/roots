import { z } from "zod";

/**
 * Typed catalog of background jobs.
 *
 * Adding a new job is done in two steps:
 *   1. Add an entry below with a Zod schema for its payload.
 *   2. Register a handler at startup (`apps/api/src/workers/index.ts`).
 *
 * Names follow `agent.<verb>` for AI normalisers and `system.<verb>` for
 * infrastructure jobs. The string is the pg-boss queue name; do not reuse.
 *
 * See: docs/feedback-plans/04-ai-agents/07_agent_runtime_and_queue.txt
 */

export const orgScopePayload = z.object({
  organizationId: z.string().uuid().optional(),
});

export const jobCatalog = {
  "agent.organization-normalize": z.object({
    organizationId: z.string().uuid(),
  }),
  "agent.segment-normalize": z.object({
    organizationId: z.string().uuid(),
  }),
  "agent.lead-score-refresh": z.object({
    organizationId: z.string().uuid().optional(),
    bucket: z.enum(["all", "cold", "warm", "hot"]).optional(),
  }),
  "agent.duplicate-sweep": z.object({
    sinceIso: z.string().datetime().optional(),
  }),
  "agent.member-estimate-refresh": orgScopePayload,
  "agent.playbook-embed-reindex": z.object({
    kind: z.enum(["objections", "playbook"]).default("playbook"),
  }),
  "system.audit-log-archive": z.object({
    olderThanIso: z.string().datetime(),
  }),
} as const;

export type JobName = keyof typeof jobCatalog;
export type JobPayload<N extends JobName> = z.infer<(typeof jobCatalog)[N]>;

export const ALL_JOB_NAMES: JobName[] = Object.keys(jobCatalog) as JobName[];

/**
 * Stable, idempotent singleton key. Same `(name, scope, bucket)` ⇒ same key,
 * so repeated enqueue calls deduplicate via pg-boss `singletonKey`.
 */
export function singletonKey(
  name: JobName,
  parts: Record<string, string | number | undefined | null>
): string {
  const tokens = Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return `${name}|${tokens.join("&")}`;
}
