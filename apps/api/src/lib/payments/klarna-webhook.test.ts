import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyKlarnaSignature } from "./klarna-webhook";

/**
 * Connection-audit P0 #3 — Klarna webhook signature verification.
 *
 * Previously the webhook had no HMAC verification at all and only relied
 * on an IP allowlist that was empty in production, meaning anyone who knew
 * the URL pattern could flip orders to PAID. These tests pin the new
 * shared-secret HMAC behaviour so a future refactor can't silently
 * regress it.
 */

const SECRET = "test-shared-secret";
const BODY = JSON.stringify({ event_type: "checkout_complete", order_id: "abc" });

function hmacB64(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

function hmacHex(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyKlarnaSignature", () => {
  it("accepts a correct base64 signature", () => {
    expect(verifyKlarnaSignature(BODY, hmacB64(BODY, SECRET), SECRET)).toBe(true);
  });

  it("accepts a correct hex signature (legacy)", () => {
    expect(verifyKlarnaSignature(BODY, hmacHex(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects an empty signature header", () => {
    expect(verifyKlarnaSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rejects an empty secret", () => {
    expect(verifyKlarnaSignature(BODY, hmacB64(BODY, SECRET), "")).toBe(false);
  });

  it("rejects a signature for a different body (tampered payload)", () => {
    const tampered = JSON.stringify({ event_type: "checkout_complete", order_id: "evil" });
    expect(verifyKlarnaSignature(tampered, hmacB64(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects a signature computed with a different secret", () => {
    expect(
      verifyKlarnaSignature(BODY, hmacB64(BODY, "wrong-secret"), SECRET)
    ).toBe(false);
  });

  it("rejects malformed base64/hex without throwing", () => {
    expect(verifyKlarnaSignature(BODY, "not-valid-encoding!@#", SECRET)).toBe(false);
  });
});
