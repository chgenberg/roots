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
};
