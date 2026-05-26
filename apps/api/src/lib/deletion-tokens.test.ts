import { describe, expect, it } from "vitest";
import {
  DELETION_TOKEN_TTL_S,
  issueDeletionCancelToken,
  verifyDeletionCancelToken,
} from "./deletion-tokens";

const SAMPLE_UUID = "11111111-2222-3333-4444-555555555555";

describe("deletion-tokens", () => {
  it("round-trips a valid token", () => {
    const token = issueDeletionCancelToken(SAMPLE_UUID);
    const verified = verifyDeletionCancelToken(token);
    expect(verified?.userId).toBe(SAMPLE_UUID);
    expect(verified?.expiresAt).toBeGreaterThan(Date.now() / 1000);
    expect(verified?.expiresAt).toBeLessThanOrEqual(
      Date.now() / 1000 + DELETION_TOKEN_TTL_S + 1
    );
  });

  it("rejects a token with a tampered userId", () => {
    const token = issueDeletionCancelToken(SAMPLE_UUID);
    // Byt en char i userId-delen — signaturen ska inte längre matcha.
    const tampered = token.replace(
      SAMPLE_UUID,
      "11111111-2222-3333-4444-666666666666"
    );
    expect(verifyDeletionCancelToken(tampered)).toBeNull();
  });

  it("rejects a token with a tampered expires timestamp", () => {
    const token = issueDeletionCancelToken(SAMPLE_UUID, 60);
    const [userId, expires, sig] = token.split(".");
    // Förläng giltigheten med 1h utan att räkna om sig:t — ska reject:as.
    const tampered = `${userId}.${Number(expires) + 3600}.${sig}`;
    expect(verifyDeletionCancelToken(tampered)).toBeNull();
  });

  it("rejects a token with a flipped signature byte", () => {
    const token = issueDeletionCancelToken(SAMPLE_UUID);
    const flipped = token.slice(0, -1) + (token.slice(-1) === "0" ? "1" : "0");
    expect(verifyDeletionCancelToken(flipped)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = issueDeletionCancelToken(SAMPLE_UUID, -1);
    expect(verifyDeletionCancelToken(token)).toBeNull();
  });

  it("rejects empty/garbage strings", () => {
    expect(verifyDeletionCancelToken("")).toBeNull();
    expect(verifyDeletionCancelToken("not.a.token")).toBeNull();
    expect(verifyDeletionCancelToken("abc.def")).toBeNull();
    expect(
      verifyDeletionCancelToken(`${SAMPLE_UUID}.notanumber.dead`)
    ).toBeNull();
  });
});
