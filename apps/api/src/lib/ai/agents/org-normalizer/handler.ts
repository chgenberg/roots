import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations, masterRiksorganisation } from "@roots/db/schema";
import { flags } from "../../../flags";
import { childLogger } from "../../../logger";
import { auditLog } from "../../../audit";
import {
  matchRiksorganisation,
  normalizeName,
  type RiksorganisationCandidate,
} from "./normalize";

const log = childLogger("agent.org-normalize");

/**
 * Production handler for `agent.organization-normalize`.
 *
 * Steps (v1 — deterministic, no LLM call yet):
 *   1. Bail when `flags.newOrgHierarchy({ orgId })` is off.
 *   2. Load the org row.
 *   3. Compute `normalized_name` via the pure helper.
 *   4. Exact-match against `master_riksorganisation` rows on
 *      `national_federation` first, falling back to display name.
 *   5. Write back **only** to columns that are still NULL (additive — the
 *      agent never overwrites human-curated values).
 *   6. Emit `auditLog({ action: "org.normalize", ... })` with `source: "local"`
 *      and a coarse `confidence` ∈ {1, 0.5, 0} so the LLM step (plan 04/01)
 *      can rerun on `< 0.85`.
 *
 * Idempotent: re-running on an already-normalised row is a no-op (no writes,
 * no audit row).
 */
export async function runOrganizationNormalize(input: {
  organizationId: string;
}): Promise<{
  writes: number;
  matchedRiksorganisationId: string | null;
  source: "skip-flag" | "skip-missing" | "skip-nochange" | "local";
}> {
  const flagOn = flags.newOrgHierarchy({ orgId: input.organizationId });
  if (!flagOn) {
    log.debug(
      { orgId: input.organizationId },
      "newOrgHierarchy off — skipping normalize"
    );
    return { writes: 0, matchedRiksorganisationId: null, source: "skip-flag" };
  }

  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      nationalFederation: organizations.nationalFederation,
      normalizedName: organizations.normalizedName,
      displayName: organizations.displayName,
      riksorganisationId: organizations.riksorganisationId,
    })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  if (!org) {
    log.warn({ orgId: input.organizationId }, "org row not found");
    return { writes: 0, matchedRiksorganisationId: null, source: "skip-missing" };
  }

  const newNormalized = normalizeName(org.name);
  const newDisplayName = org.displayName ?? org.name;

  const rikss = await db
    .select({
      id: masterRiksorganisation.id,
      name: masterRiksorganisation.name,
    })
    .from(masterRiksorganisation);
  const candidates: RiksorganisationCandidate[] = rikss.map((r) => ({
    id: r.id,
    normalizedName: normalizeName(r.name),
  }));
  const match = matchRiksorganisation(
    { nationalFederation: org.nationalFederation, name: org.name },
    candidates
  );

  // Build the patch additively. Never overwrite existing values. Typed as
  // a `Partial<$inferInsert>` so a typo in a column name fails at compile
  // time (Drizzle's `.set()` is structurally typed).
  type OrgPatch = Partial<typeof organizations.$inferInsert>;
  const patch: OrgPatch = {};
  if (org.normalizedName === null && newNormalized) {
    patch.normalizedName = newNormalized;
  }
  if (org.displayName === null && newDisplayName) {
    patch.displayName = newDisplayName;
  }
  if (org.riksorganisationId === null && match.riksorganisationId) {
    patch.riksorganisationId = match.riksorganisationId;
  }

  if (Object.keys(patch).length === 0) {
    return {
      writes: 0,
      matchedRiksorganisationId: match.riksorganisationId,
      source: "skip-nochange",
    };
  }

  // Touch `updatedAt` since the schema declares it `defaultNow()` without
  // `$onUpdate`. Counted separately in the `writes` return so callers see the
  // real number of business fields that changed.
  const businessWrites = Object.keys(patch).length;
  patch.updatedAt = new Date();

  await db
    .update(organizations)
    .set(patch)
    .where(eq(organizations.id, org.id));

  const confidence = match.riksorganisationId
    ? match.matchedOn === "national_federation"
      ? 1
      : 0.5
    : 0;

  void auditLog({
    action: "org.normalize",
    entityType: "organization",
    entityId: org.id,
    meta: {
      source: "local",
      confidence,
      matchedOn: match.matchedOn,
      wrote: Object.keys(patch),
    },
  });

  log.info(
    {
      orgId: org.id,
      wrote: Object.keys(patch),
      riksorganisationId: match.riksorganisationId,
      confidence,
    },
    "org normalised"
  );

  return {
    writes: businessWrites,
    matchedRiksorganisationId: match.riksorganisationId,
    source: "local",
  };
}
