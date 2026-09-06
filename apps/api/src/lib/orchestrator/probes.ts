import { eq, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations, payouts } from "@roots/db/schema";
import { getJobStatuses } from "../monitoring/heartbeat";
import type { DomainId } from "./graph";
import type { Gate } from "./approvals";

export type Seed = {
  key: string;
  title: string;
  body: string;
  domainId: DomainId;
  gate: Gate;
  files: string[];
};

export function isEmailPaused(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FEATURE_EMAIL_DISABLED?.trim().toLowerCase() === "true";
}

export const SINGLETON_KEYS = [
  "email-paused",
  "pending-payouts",
  "pending-org-review",
] as const;

export async function probeEmailPaused(): Promise<Seed[]> {
  if (!isEmailPaused()) return [];
  return [
    {
      key: "email-paused",
      title: "Mejl är pausade",
      body: "FEATURE_EMAIL_DISABLED är på. Transaktionsmejl går till mock. Lyft inte flaggan från en Hand.",
      domainId: "email",
      gate: "email",
      files: ["apps/api/src/lib/email/index.ts"],
    },
  ];
}

export async function probePendingPayouts(): Promise<Seed[]> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(payouts)
      .where(eq(payouts.status, "PENDING"));
    const n = row?.n ?? 0;
    if (n === 0) return [];
    return [
      {
        key: "pending-payouts",
        title: `${n} utbetalningar väntar`,
        body: `${n} rader har status PENDING. Markera inte PAID och skicka inte Fortnox från pulsen.`,
        domainId: "money",
        gate: "money",
        files: ["apps/api/src/routes/payouts.ts"],
      },
    ];
  } catch {
    return [];
  }
}

export async function probeStaleJobs(): Promise<Seed[]> {
  try {
    const jobs = await getJobStatuses();
    return jobs
      .filter((j) => j.stale)
      .map((j) => ({
        key: `stale-job:${j.name}`,
        title: `Jobbet ${j.name} har tystnat`,
        body: j.description,
        domainId: "admin" as const,
        gate: "none" as const,
        files: ["apps/api/src/lib/monitoring/heartbeat.ts"],
      }));
  } catch {
    return [];
  }
}

export async function probePendingOrgReview(): Promise<Seed[]> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(organizations)
      .where(eq(organizations.verified, false));
    const n = row?.n ?? 0;
    if (n === 0) return [];
    return [
      {
        key: "pending-org-review",
        title: `${n} föreningar väntar på granskning`,
        body: `${n} föreningar har verified=false. Godkänn dem i /portal/granskning — inte från pulsen.`,
        domainId: "admin",
        gate: "none",
        files: [
          "apps/api/src/routes/admin.ts",
          "apps/web/src/app/(portal)/portal/granskning/page.tsx",
        ],
      },
    ];
  } catch {
    return [];
  }
}
