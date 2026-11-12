/**
 * INTEGRATIONSTEST — vem som får läsa medlemslistan.
 *
 * Säljare och lagledare bär föreningens orgId i sin session. Medlemslistan
 * filtrerade bara på orgId, så en säljare kunde läsa namn och e-post för alla
 * konton i föreningen. Testet går mot en riktig databas eftersom felet satt i
 * kombinationen av sessionens innehåll och frågan, inte i någon enskild rad.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("portalens medlemslista (integration)", () => {
  let db: typeof import("@roots/db")["db"];
  let schema: typeof import("@roots/db/schema");
  let app: typeof import("../app")["app"];
  let createSession: typeof import("../lib/session")["createSession"];
  let eq: typeof import("drizzle-orm")["eq"];

  const run = randomUUID().slice(0, 8);
  const ids = { org: "", seller: "", leader: "", clubAdmin: "" };

  beforeAll(async () => {
    ({ db } = await import("@roots/db"));
    schema = await import("@roots/db/schema");
    ({ app } = await import("../app"));
    ({ createSession } = await import("../lib/session"));
    ({ eq } = await import("drizzle-orm"));

    // Tills Redis hunnit ansluta läggs sessioner i minnet, och läses sedan
    // från Redis. Vänta in anslutningen så att en session som skapas här
    // också går att läsa i nästa anrop.
    const { redis } = await import("../lib/redis");
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await redis.ping();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const [org] = await db
      .insert(schema.organizations)
      .values({ name: `E2E Medlemmar ${run}`, type: "association", verified: true })
      .returning();
    ids.org = org.id;

    const rows = await db
      .insert(schema.users)
      .values(
        (["SELLER", "TEAM_LEADER", "CLUB_ADMIN"] as const).map((role) => ({
          email: `e2e-${role.toLowerCase()}-${run}@roots-test.local`,
          passwordHash: "not-used-in-this-test",
          role,
          orgId: org.id,
          contactName: `Test ${role}`,
        }))
      )
      .returning();
    ids.seller = rows.find((u) => u.role === "SELLER")!.id;
    ids.leader = rows.find((u) => u.role === "TEAM_LEADER")!.id;
    ids.clubAdmin = rows.find((u) => u.role === "CLUB_ADMIN")!.id;
  });

  afterAll(async () => {
    if (!HAS_DB || !db || !ids.org) return;
    await db.delete(schema.users).where(eq(schema.users.orgId, ids.org));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.org));
  });

  async function membersAs(userId: string, role: string) {
    const sessionId = await createSession({
      userId,
      role: role as never,
      orgId: ids.org,
      createdAt: Date.now(),
    });
    return app.request("/v1/portal/members", {
      headers: { cookie: `rootsSessionId=${sessionId}` },
    });
  }

  it("nekar säljare och lagledare", async () => {
    for (const [userId, role] of [
      [ids.seller, "SELLER"],
      [ids.leader, "TEAM_LEADER"],
    ]) {
      const res = await membersAs(userId, role);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { members?: unknown };
      expect(body.members).toBeUndefined();
    }
  });

  it("visar listan för klubbens admin", async () => {
    const res = await membersAs(ids.clubAdmin, "CLUB_ADMIN");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: Array<{ email: string }> };
    expect(body.members).toHaveLength(3);
  });
});
