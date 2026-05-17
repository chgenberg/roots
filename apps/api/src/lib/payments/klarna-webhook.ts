import { createHmac, timingSafeEqual } from "crypto";

/**
 * Klarna push-notification signature verifier.
 *
 * Klarna sends `Klarna-Signature` as a base64-encoded HMAC-SHA256 of the
 * raw request body when the subscriber is configured with a shared secret.
 * Older integrations occasionally publish hex-encoded signatures, so we
 * accept either encoding (timing-safe, constant-time comparison either way).
 *
 * See: https://docs.klarna.com/api/payments/#push-notifications
 *
 * Returns `false` for any of: no secret configured, empty signature header,
 * length mismatch, encoding mismatch, or value mismatch.
 */
export function verifyKlarnaSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!secret || !signatureHeader) return false;

  const expectedBuf = createHmac("sha256", secret).update(rawBody).digest();

  for (const enc of ["base64", "hex"] as const) {
    try {
      const sigBuf = Buffer.from(signatureHeader, enc);
      if (
        sigBuf.length === expectedBuf.length &&
        timingSafeEqual(sigBuf, expectedBuf)
      ) {
        return true;
      }
    } catch {
      // try next encoding
    }
  }
  return false;
}
