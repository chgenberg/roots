/**
 * Provisions the isolated feedback account. Signup never offers this
 * mailbox — this script (or API boot via REVIEWER_PASSWORD) is the writer.
 *
 *   DATABASE_URL='postgresql://…' \
 *   REVIEWER_EMAIL=feedback@roots.nu \
 *   REVIEWER_PASSWORD='…' \
 *   REVIEWER_NAME='Feedback' \
 *   pnpm --filter @roots/api exec tsx src/scripts/create-reviewer.ts
 */
import { ensureReviewerAccount, reviewerEmailFromEnv } from "../lib/ensure-reviewer";

async function main() {
  if (!process.env.REVIEWER_PASSWORD) {
    throw new Error("REVIEWER_PASSWORD saknas — vägrar skapa konto utan secret.");
  }
  await ensureReviewerAccount();
  console.log("reviewer klar:", reviewerEmailFromEnv());
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
