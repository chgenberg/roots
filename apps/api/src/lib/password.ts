import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}

const COMMON_PASSWORDS = new Set([
  "password1234",
  "123456789012",
  "qwertyuiopas",
  "abcdefghijkl",
]);

export function isPasswordAcceptable(password: string): {
  ok: boolean;
  reason?: string;
} {
  if (password.length < 12) {
    return { ok: false, reason: "Password must be at least 12 characters" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: "This password is too common" };
  }
  return { ok: true };
}
