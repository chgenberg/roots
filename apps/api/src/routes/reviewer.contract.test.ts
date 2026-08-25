import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isReviewerEmail, REVIEWER_EMAILS, REVIEWER_HOME } from "@roots/contracts";

const repo = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(repo, rel), "utf8");
}

/**
 * Locks the QueenCloud-style feedback flow after it was ported to Roots.
 * These source-readbacks fail if login, admin inbox, OpenAI, or Resend
 * notify drift back to AWS/Prisma or if the password is committed.
 */
describe("reviewer feedback contract", () => {
  it("allowlist is only feedback@roots.nu", () => {
    expect([...REVIEWER_EMAILS]).toEqual(["feedback@roots.nu"]);
    expect(isReviewerEmail("feedback@roots.nu")).toBe(true);
    expect(isReviewerEmail("admin@roots.se")).toBe(false);
    expect(REVIEWER_HOME).toBe("/feedback");
  });

  it("API routes require reviewer or INTERNAL_ADMIN and use OpenAI + Resend", () => {
    const reviewer = read("apps/api/src/routes/reviewer.ts");
    const admin = read("apps/api/src/routes/admin.ts");
    const llm = read("apps/api/src/lib/reviewer-llm.ts");
    const notify = read("apps/api/src/lib/reviewer-notify.ts");
    const app = read("apps/api/src/app.ts");

    expect(reviewer).toMatch(/requireReviewer/);
    expect(reviewer).toMatch(/llmReviewerTurn/);
    expect(reviewer).toMatch(/llmReviewerPrompt/);
    expect(reviewer).toMatch(/notifyFeedbackSubmitted/);
    expect(admin).toMatch(/admin\.get\("\/feedback"/);
    expect(admin).toMatch(/requireInternalAdmin/);
    expect(admin).toMatch(/INTERNAL_ADMIN/);
    expect(llm).toMatch(/api\.openai\.com|OPENAI_BASE_URL/);
    expect(llm).not.toMatch(/bedrock|@aws-sdk\/client-bedrock/i);
    expect(notify).toMatch(/ch\.genberg@gmail\.com/);
    expect(notify).toMatch(/getEmailSender\(\)\.sendEmail/);
    expect(app).toMatch(/app\.route\("\/v1\/reviewer"/);
  });

  it("login and middleware send the reviewer to /feedback", () => {
    const login = read("apps/web/src/app/(auth)/login/page.tsx");
    const middleware = read("apps/web/src/middleware.ts");
    expect(login).toMatch(/isReviewerEmail/);
    expect(login).toMatch(/REVIEWER_HOME/);
    expect(middleware).toMatch(/isReviewerEmail/);
    expect(middleware).toMatch(/\/feedback/);
    expect(middleware).toMatch(/GATE_BYPASS_PREFIXES[\s\S]*\/login/);
    expect(middleware).toMatch(/GATE_BYPASS_PREFIXES[\s\S]*\/feedback/);
  });

  it("never commits the feedback password", () => {
    const ensure = read("apps/api/src/lib/ensure-reviewer.ts");
    const script = read("apps/api/src/scripts/create-reviewer.ts");
    expect(ensure).toMatch(/REVIEWER_PASSWORD/);
    expect(ensure).not.toMatch(/Roots123%/);
    expect(script).not.toMatch(/Roots123%/);
  });

  it("admin nav exposes Feedback for INTERNAL_ADMIN", () => {
    const shell = read("apps/web/src/app/(portal)/portal/portal-shell.tsx");
    expect(shell).toMatch(/\/portal\/feedback/);
    expect(shell).toMatch(/navFeedback/);
  });
});
