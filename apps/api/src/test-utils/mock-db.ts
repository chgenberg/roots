import { vi } from "vitest";

/**
 * Lightweight mock for `@roots/db` that lets a test enqueue the result of
 * each drizzle query call **in order**. Every chainable method
 * (`.from`, `.where`, `.orderBy`, `.groupBy`, `.limit`, `.innerJoin`, …)
 * returns the same proxy, and awaiting the proxy resolves to the next
 * queued value (defaulting to `[]`).
 *
 * Used by API snapshot tests so we lock the exact JSON wire format that
 * UI consumes today without spinning a real Postgres instance.
 *
 * Pair with `vi.mock("@roots/db", () => makeMockDbModule())`.
 */

export interface MockDbHandle {
  queue: unknown[];
  reset: (next?: unknown[]) => void;
}

export function makeMockDb(initial: unknown[] = []): {
  db: any;
  handle: MockDbHandle;
} {
  const state = { queue: [...initial] };
  let idx = 0;

  const dequeue = (): unknown => {
    const v = idx < state.queue.length ? state.queue[idx] : [];
    idx += 1;
    return v;
  };

  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: any, reject?: any) => {
            try {
              const v = dequeue();
              return Promise.resolve(v).then(resolve, reject);
            } catch (err) {
              return Promise.reject(err).then(resolve, reject);
            }
          };
        }
        if (prop === "returning") {
          return () => chain;
        }
        return (..._args: any[]) => chain;
      },
    }
  );

  const db = {
    select: (..._args: any[]) => chain,
    insert: (..._args: any[]) => chain,
    update: (..._args: any[]) => chain,
    delete: (..._args: any[]) => chain,
    execute: vi.fn().mockResolvedValue([{ ok: 1 }]),
    transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  };

  const handle: MockDbHandle = {
    queue: state.queue,
    reset(next?: unknown[]) {
      state.queue.length = 0;
      if (next) state.queue.push(...next);
      idx = 0;
    },
  };

  return { db, handle };
}
