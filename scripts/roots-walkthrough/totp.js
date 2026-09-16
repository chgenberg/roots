import { createHmac } from "node:crypto";

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input)
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpFromSecret(secret, at = Date.now()) {
  const key = base32Decode(secret);
  if (key.length === 0) throw new Error("Tom TOTP-nyckel.");
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}
