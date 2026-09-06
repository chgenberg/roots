/**
 * Scheduled tick: probe → upsert cards → resolve gone → Hands → OrchestratorRun.
 * Never deploy or irreversible Hands here.
 */

import { runSafeHands } from "./hands";
import {
  probeEmailPaused,
  probePendingOrgReview,
  probePendingPayouts,
  probeStaleJobs,
  SINGLETON_KEYS,
  type Seed,
} from "./probes";
import {
  createHeartbeatCard,
  createRun,
  findCardByKey,
  finishRun,
  latestHeartbeatRun,
  listOpenHeartbeatKeys,
  markCardDone,
  reopenCard,
  tablesMissing,
  wireOrchestratorStore,
} from "./store";

export type HeartbeatCheck = {
  probe: () => Promise<Seed[]>;
};

export const CHECKS: HeartbeatCheck[] = [
  { probe: probeEmailPaused },
  { probe: probePendingPayouts },
  { probe: probeStaleJobs },
  { probe: probePendingOrgReview },
];

export type HeartbeatResult = {
  ok: boolean;
  runId: string | null;
  findings: number;
  opened: string[];
  resolved: string[];
  fixed: string[];
  summary: string;
  at: string;
};

async function upsertOpen(seed: Seed): Promise<"opened" | "kept"> {
  const existing = await findCardByKey(seed.key);
  if (existing && existing.status !== "done") return "kept";
  const payload = {
    title: seed.title,
    body: seed.body,
    domainId: seed.domainId,
    gate: seed.gate,
    filesJson: JSON.stringify(seed.files),
  };
  if (existing && existing.status === "done") {
    await reopenCard(seed.key, payload);
    return "opened";
  }
  await createHeartbeatCard({ key: seed.key, ...payload });
  return "opened";
}

async function resolveIfOpen(key: string): Promise<boolean> {
  const row = await findCardByKey(key);
  if (!row || row.status === "done") return false;
  await markCardDone(key, `${row.body}\n\nLöst av heartbeat.`);
  return true;
}

export async function runHeartbeat(): Promise<HeartbeatResult> {
  const at = new Date().toISOString();
  wireOrchestratorStore();

  let runId: string | null = null;
  try {
    const run = await createRun();
    runId = run.id;
  } catch (e) {
    if (tablesMissing(e)) {
      return {
        ok: false,
        runId: null,
        findings: 0,
        opened: [],
        resolved: [],
        fixed: [],
        summary: "Orchestrator-tabeller saknas. Kör migrationen.",
        at,
      };
    }
    throw e;
  }

  try {
    const opened: string[] = [];
    const resolved: string[] = [];
    const liveKeys = new Set<string>();
    const prefixes = new Set<string>();

    for (const check of CHECKS) {
      const seeds = await check.probe();
      for (const seed of seeds) {
        liveKeys.add(seed.key);
        const colon = seed.key.indexOf(":");
        if (colon > 0) prefixes.add(seed.key.slice(0, colon + 1));
        const r = await upsertOpen(seed);
        if (r === "opened") opened.push(seed.key);
      }
    }

    for (const prefix of prefixes) {
      const openKeys = await listOpenHeartbeatKeys(prefix);
      for (const key of openKeys) {
        if (!liveKeys.has(key) && (await resolveIfOpen(key))) {
          resolved.push(key);
        }
      }
    }

    for (const key of SINGLETON_KEYS) {
      if (!liveKeys.has(key) && (await resolveIfOpen(key))) {
        resolved.push(key);
      }
    }

    const fixed = await runSafeHands([...liveKeys]);
    for (const key of fixed) liveKeys.delete(key);

    const findings = liveKeys.size;
    const summary =
      findings === 0 &&
      opened.length === 0 &&
      resolved.length === 0 &&
      fixed.length === 0
        ? "HEARTBEAT_OK"
        : `${findings} öppna, ${opened.length} nya, ${resolved.length} lösta, ${fixed.length} lagade.`;

    await finishRun(runId, { status: "ok", summary, findings });

    return { ok: true, runId, findings, opened, resolved, fixed, summary, at };
  } catch (e) {
    const summary = e instanceof Error ? e.message : "HEARTBEAT_FAILED";
    await finishRun(runId, { status: "error", summary, findings: 0 }).catch(
      () => {}
    );
    return {
      ok: false,
      runId,
      findings: 0,
      opened: [],
      resolved: [],
      fixed: [],
      summary,
      at,
    };
  }
}

export { latestHeartbeatRun };

export async function noteNightlyFailure(message: string): Promise<void> {
  try {
    await upsertOpen({
      key: `nightly-error:${new Date().toISOString().slice(0, 10)}`,
      title: "Nightly cron misslyckades",
      body: message.slice(0, 500),
      domainId: "admin",
      gate: "none",
      files: [],
    });
  } catch {
    // Tables may not exist yet.
  }
}
