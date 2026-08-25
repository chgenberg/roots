import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db } from "@roots/db";
import { users } from "@roots/db/schema";
import { isReviewerEmail } from "@roots/contracts";
import { childLogger } from "./logger";

const log = childLogger("ensure-reviewer");

/** Same parameters as `routes/auth.ts` so login can verify the hash. */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export function reviewerEmailFromEnv(): string {
  return (process.env.REVIEWER_EMAIL || "feedback@roots.nu").trim().toLowerCase();
}

/**
 * Creates or updates the isolated feedback account. Password comes from
 * REVIEWER_PASSWORD — never from source. Skips quietly when the secret
 * is missing so a misconfigured deploy does not crash the API.
 */
export async function ensureReviewerAccount(): Promise<void> {
  const email = reviewerEmailFromEnv();
  const password = process.env.REVIEWER_PASSWORD;
  const name = process.env.REVIEWER_NAME || "Feedback";

  if (!isReviewerEmail(email) && email !== "feedback@roots.nu") {
    log.warn({ email: email.slice(0, 40) }, "REVIEWER_EMAIL is outside the allowlist — skip");
    return;
  }
  if (!password || password.length < 8) {
    log.warn("REVIEWER_PASSWORD missing or too short — feedback account not provisioned");
    return;
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        contactName: name,
        role: "PUBLIC",
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    log.info({ email }, "reviewer account updated");
    return;
  }

  await db.insert(users).values({
    email,
    passwordHash,
    role: "PUBLIC",
    contactName: name,
  });
  log.info({ email }, "reviewer account created");
}
