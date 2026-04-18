import { db, auditLogs } from "@roots/db";
import { flags } from "./flags";
import { childLogger } from "./logger";

const log = childLogger("audit");

export interface AuditEvent {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit log writer.
 *
 * Never throws — audit write failures must never block the user action
 * they describe. Controlled by FEATURE_AUDIT_LOGGING (default: on).
 *
 * For HTTP request audit events call with `ip` and `userAgent` in `meta`
 * so they end up in the same `meta` JSONB column without adding columns.
 */
export async function auditLog(event: AuditEvent): Promise<void> {
  if (!flags.auditLogging()) return;
  try {
    await db.insert(auditLogs).values({
      userId: event.userId ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      meta: event.meta ?? null,
    });
  } catch (err) {
    log.warn({ err, action: event.action }, "audit log write failed");
  }
}

/**
 * Extract request context (ip, user-agent) for use as audit `meta`.
 */
export function requestContext(
  headers: (name: string) => string | undefined
): { ip: string; userAgent: string } {
  const ip =
    headers("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers("x-real-ip") ||
    "unknown";
  const userAgent = headers("user-agent")?.slice(0, 200) || "unknown";
  return { ip, userAgent };
}
