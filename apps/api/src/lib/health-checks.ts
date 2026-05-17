/**
 * Health-check helpers (Sprint D — Prod-konfig).
 *
 * `/healthz` is liveness — does the process respond at all? It must NOT
 * touch the DB or Redis because we don't want a flapping dependency to
 * trigger an unnecessary container restart on Railway/Cloud Run.
 *
 * `/readyz` is readiness — should this instance receive traffic? It
 * pings the DB and Redis with strict timeouts. If either is down we
 * return 503 so the load balancer pulls the instance out of rotation
 * (or, on Railway single-instance, lets the operator see the failure
 * in the deploy status page).
 */

import { sql } from "drizzle-orm";
import { db } from "@roots/db";
import { redis } from "./redis";

const PING_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}

export interface ReadinessReport {
  ok: boolean;
  db: { ok: boolean; latencyMs?: number; error?: string };
  redis: { ok: boolean; latencyMs?: number; error?: string };
}

export async function checkReadiness(): Promise<ReadinessReport> {
  const dbCheck = (async () => {
    const start = Date.now();
    try {
      await withTimeout(
        // Single-row literal SELECT — drizzle compiles this to
        // `select 1` against whatever DB you point it at, so it works
        // identically for Postgres-in-Docker and Railway-managed PG.
        db.execute(sql`select 1`),
        PING_TIMEOUT_MS
      );
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  })();

  const redisCheck = (async () => {
    const start = Date.now();
    try {
      await withTimeout(redis.ping(), PING_TIMEOUT_MS);
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  })();

  const [d, r] = await Promise.all([dbCheck, redisCheck]);
  return { ok: d.ok && r.ok, db: d, redis: r };
}
