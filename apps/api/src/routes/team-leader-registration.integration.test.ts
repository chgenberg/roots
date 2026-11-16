/**
 * INTEGRATIONSTEST — ett lag eller en klass kan inte registrera sig själv.
 *
 * Beslut 16 nov 2026: försäljningen startas alltid via föreningen eller
 * tillsammans med Roots. Tidigare skapade adressen ett konto och en egen
 * organisation utan lag, och användaren hamnade på en felruta.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("självregistrering av lagledare (integration)", () => {
  let db: typeof import("@roots/db")["db"];
  let schema: typeof import("@roots/db/schema");
  let app: typeof import("../app")["app"];
  let eq: typeof import("drizzle-orm")["eq"];

  const run = randomUUID().slice(0, 8);
  const email = `e2e-sjalvreg-${run}@roots-test.local`;
  const orgName = `E2E Självregistrerad ${run}`;

  beforeAll(async () => {
    ({ db } = await import("@roots/db"));
    schema = await import("@roots/db/schema");
    ({ app } = await import("../app"));
    ({ eq } = await import("drizzle-orm"));
  });

  afterAll(async () => {
    if (!HAS_DB || !db) return;
    // Ska inte finnas något att städa. Står det kvar rader har testet fallit.
    await db.delete(schema.users).where(eq(schema.users.email, email));
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.name, orgName));
  });

  it("svarar 410 med en förklaring och skapar varken konto eller förening", async () => {
    const csrf = await app.request("/v1/csrf-token");
    const { token } = (await csrf.json()) as { token: string };

    const res = await app.request("/v1/auth/register/team-leader", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({
        teamName: "P13 Blå",
        orgName,
        email,
        password: "ett-tillrackligt-langt-losenord-1",
        contactName: "Test Lagledare",
      }),
    });

    expect(res.status).toBe(410);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/förening/i);
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/rootsSessionId/);

    const users = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    expect(users).toHaveLength(0);

    const orgs = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, orgName));
    expect(orgs).toHaveLength(0);
  });
});
