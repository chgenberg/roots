/**
 * Hands — the platform fixes what it already knows how to fix.
 * Never irreversible, never deploy, never lift the mail pause, never set price.
 */

import type { CardStatus } from "./workboard-types";

export type HandResult = {
  ok: boolean;
  did: string;
};

/** Per-prefix caps. Add a row when you add a Hand. */
const CAPS: { test: (key: string) => boolean; max: number }[] = [];

export async function tryFixKey(_key: string): Promise<HandResult | null> {
  if (_key === "email-paused" || _key.startsWith("nightly-error:")) {
    return null;
  }
  if (
    _key === "pending-payouts" ||
    _key === "pending-org-review" ||
    _key.startsWith("stale-job:")
  ) {
    return null;
  }
  return null;
}

type CardWriter = {
  findUnique: (args: { where: { key: string } }) => Promise<{ body: string } | null>;
  update: (args: {
    where: { key: string };
    data: { status: CardStatus; body: string };
  }) => Promise<unknown>;
};

let cardWriter: CardWriter | null = null;

export function setCardWriter(writer: CardWriter | null) {
  cardWriter = writer;
}

export async function stampCard(
  key: string,
  status: "done" | "inbox",
  note: string
) {
  if (!cardWriter) return;
  const row = await cardWriter.findUnique({ where: { key } });
  if (!row) return;
  const body = row.body.includes(note) ? row.body : `${row.body}\n\n${note}`;
  await cardWriter.update({
    where: { key },
    data: { status, body },
  });
}

export async function runSafeHands(keys: string[]): Promise<string[]> {
  const fixed: string[] = [];
  const used = new Map<number, number>();
  for (const key of keys) {
    const capIdx = CAPS.findIndex((c) => c.test(key));
    if (capIdx >= 0) {
      const n = used.get(capIdx) ?? 0;
      if (n >= CAPS[capIdx].max) continue;
      used.set(capIdx, n + 1);
    }
    try {
      const result = await tryFixKey(key);
      if (!result) continue;
      if (result.ok) {
        await stampCard(key, "done", result.did);
        fixed.push(key);
      } else {
        await stampCard(key, "inbox", result.did);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 180) : "HAND_FAILED";
      await stampCard(key, "inbox", `Kunde inte laga: ${msg}`).catch(() => {});
    }
  }
  return fixed;
}
