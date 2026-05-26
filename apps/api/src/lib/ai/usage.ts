/**
 * P3.35 + P3.36 (audit 2026-05-26): centralt ställe att rapportera
 * AI-användning. Tidigare läste vi `usage.promptTokens/completionTokens`
 * från OpenAI men kastade dem; `/portal/system` hardcodade
 * `tokensToday/Month: null`. Routes ska kalla `recordAiUsage()` efter
 * varje completion så ops kan se kostnad per surface.
 *
 * Vi skriver TILL audit_logs (action `ai.usage`) i stället för att lägga
 * en separat tabell — det går att aggregera per dag/månad via samma
 * audit-query som drar admin-feeds, och en miljöstämpel räcker som
 * "varifrån kom anropet".
 *
 * Surface-namn ska vara stabila och kort: "public_chat", "portal_chat",
 * "hair_analysis", "agents.org_normalizer" osv.
 */

import { auditLog } from "../audit";
import { childLogger } from "../logger";

const log = childLogger("ai-usage");

export interface AiUsageEvent {
  surface: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  userId?: string | null;
  orgId?: string | null;
  /** Fritext för t.ex. fallback-orsak, errorCode, etc. */
  meta?: Record<string, unknown>;
}

export function recordAiUsage(event: AiUsageEvent): void {
  const prompt = event.promptTokens ?? 0;
  const completion = event.completionTokens ?? 0;
  void auditLog({
    userId: event.userId ?? null,
    action: "ai.usage",
    entityType: "ai_call",
    meta: {
      surface: event.surface,
      model: event.model,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion,
      orgId: event.orgId ?? null,
      ...event.meta,
    },
  });
  log.debug(
    { surface: event.surface, model: event.model, prompt, completion },
    "ai usage recorded"
  );
}

/**
 * P3.36: separat event för fel/fallback/rate-limit så att admin-feeds
 * och kostnadsanalys kan särskilja "betalt + fungerade" från "vi
 * skickade fallback".
 */
export function recordAiIncident(event: {
  surface: string;
  kind: "rate_limited" | "fallback" | "upstream_error";
  status?: number;
  userId?: string | null;
  orgId?: string | null;
  meta?: Record<string, unknown>;
}): void {
  void auditLog({
    userId: event.userId ?? null,
    action: `ai.${event.kind}`,
    entityType: "ai_call",
    meta: {
      surface: event.surface,
      status: event.status ?? null,
      orgId: event.orgId ?? null,
      ...event.meta,
    },
  });
}
