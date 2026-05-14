/**
 * Central feature-flag registry.
 *
 * Rules:
 * - Every flag MUST default to the safe/current behaviour (usually `false`)
 *   so rollout is explicit and backward-compatible.
 * - Flags are read from process.env at runtime and treated as strings.
 *   Truthy values: "1", "true", "on", "yes" (case-insensitive).
 * - Use `isEnabled("FLAG_NAME")` instead of hardcoding logic by environment.
 */

const TRUTHY = new Set(["1", "true", "on", "yes"]);

function readEnv(key: string): string | undefined {
  return process.env[key];
}

export function isEnabled(flag: string, fallback = false): boolean {
  const raw = readEnv(flag);
  if (raw === undefined || raw === null || raw === "") return fallback;
  return TRUTHY.has(String(raw).trim().toLowerCase());
}

const ORG_SEP = /[,;\s]+/;

/**
 * Strategic rollout flags: `FEATURE_<NAME>` (truthy = on).
 * Optional allowlist: `FEATURE_<NAME>_ORGS` = comma-separated org UUIDs.
 * When the allowlist is non-empty, only those orgs match; missing orgId → false.
 */
export function featureOn(
  name: string,
  ctx?: { orgId?: string }
): boolean {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!normalized) return false;
  const key = `FEATURE_${normalized}`;
  if (!isEnabled(key, false)) return false;

  const allow = readEnv(`${key}_ORGS`);
  if (allow === undefined || allow === null || String(allow).trim() === "") {
    return true;
  }
  const orgId = ctx?.orgId;
  if (!orgId) return false;
  const set = new Set(
    String(allow)
      .split(ORG_SEP)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return set.has(orgId);
}

/** Centralised, well-named helpers so call sites never typo an env key. */
export const flags = {
  /** Master switch for AI features. When false, all AI surfaces degrade to
   *  fallback copy without hitting OpenAI. */
  aiEnabled(): boolean {
    return isEnabled("AI_ENABLED", true);
  },

  /** Persist ChatWidget history in sessionStorage. */
  chatHistoryPersistence(): boolean {
    return isEnabled("FEATURE_CHAT_HISTORY_PERSISTENCE", false);
  },

  /** Use the session-aware /v1/ai/chat endpoint for authenticated portal
   *  surfaces, instead of the public chat endpoint. */
  portalAiUseSessionEndpoint(): boolean {
    return isEnabled("FEATURE_PORTAL_AI_SESSION_ENDPOINT", false);
  },

  /** Write to audit_logs from sensitive flows (auth, campaign status,
   *  seller create). */
  auditLogging(): boolean {
    return isEnabled("FEATURE_AUDIT_LOGGING", true);
  },

  /** Enable pg-boss worker pool and schedule lifecycle jobs. */
  workersEnabled(): boolean {
    return isEnabled("WORKERS_ENABLED", false);
  },

  /** Show a small badge ("Live data" / "Demo-data") next to KPI cards. */
  dataSourceBadge(): boolean {
    return isEnabled("FEATURE_DATA_SOURCE_BADGE", true);
  },

  /** Persist checkout cart in sessionStorage across navigations. */
  cartPersistence(): boolean {
    return isEnabled("FEATURE_CART_PERSISTENCE", true);
  },

  /** Masterdata / CRM hierarchy (riksorg, segment, org 2.0). See docs/feedback-plans/01-master-data/. */
  newOrgHierarchy(ctx?: { orgId?: string }): boolean {
    return featureOn("NEW_ORG_HIERARCHY", ctx);
  },

  /** Payout aggregation keyed by group_unit (parallel to team); see 08-ecommerce-integration. */
  payoutByGroupUnit(ctx?: { orgId?: string }): boolean {
    return featureOn("PAYOUT_BY_GROUP_UNIT", ctx);
  },
};
