import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { db } from "@roots/db";
import { outreachLeads, outreachSenders } from "@roots/db/schema";
import { eq } from "drizzle-orm";
import { claimNextApproved } from "./outreach";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("lead-mejl: samtidiga utskick", () => {
  let senderId = "";

  beforeAll(async () => {
    const [s] = await db
      .insert(outreachSenders)
      .values({
        name: "Test Claim",
        email: "claim-test@roots.nu",
        subjectTemplate: "x",
        bodyTemplate: "x",
      })
      .returning();
    senderId = s!.id;
    await db.insert(outreachLeads).values(
      Array.from({ length: 5 }, (_, i) => ({
        senderId,
        orgName: `Förening ${i}`,
        email: `f${i}@claim-test.se`,
        token: randomBytes(9).toString("base64url").slice(0, 12),
        status: "approved",
        approvedAt: new Date(Date.now() + i),
      }))
    );
  });

  afterAll(async () => {
    if (senderId) await db.delete(outreachSenders).where(eq(outreachSenders.id, senderId));
  });

  it("delar aldrig ut samma rad två gånger", async () => {
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimNextApproved(senderId)));
    const ids = claims.filter((l) => l !== null).map((l) => l!.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(await claimNextApproved(senderId)).toBeNull();
  });
});
