/**
 * INTEGRATIONSTEST — Stripes webhook när ordern inte går att hitta.
 *
 * Tidigare svarade vi 200 och förbrukade dedup-nyckeln. Stripe slutade då
 * försöka, och en kund kunde stå betald utan order. Testet skickar riktigt
 * signerade händelser genom samma signaturkontroll som i drift.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const WEBHOOK_SECRET = "whsec_integration_test_secret";

describe.skipIf(!HAS_DB)("Stripe-webhook utan matchande order (integration)", () => {
  let app: typeof import("../app")["app"];
  /** Samma märke som kassan sätter på sina sessioner. */
  let site = "";
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  };
  const run = randomUUID().slice(0, 8);
  const stripe = new Stripe("sk_test_integration_dummy");

  beforeAll(async () => {
    // Signaturkontrollen räknas lokalt; nyckeln används aldrig mot Stripe.
    process.env.STRIPE_SECRET_KEY = "sk_test_integration_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    ({ app } = await import("../app"));
    site = (await import("@roots/contracts")).resolveCanonicalSiteUrl();
  });

  afterAll(() => {
    if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.key;
    if (previous.secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous.secret;
  });

  function deliver(event: Record<string, unknown>) {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    return app.request("/v1/checkout/webhook/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    });
  }

  function sessionEvent(
    name: string,
    type: string,
    session: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      id: `evt_test_${name}_${run}`,
      object: "event",
      type,
      data: {
        object: {
          id: `cs_test_${name}_${run}`,
          object: "checkout.session",
          amount_total: 39_900,
          currency: "sek",
          ...session,
        },
      },
    };
  }

  it("avvisar en händelse med fel signatur", async () => {
    const res = await app.request("/v1/checkout/webhook/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
      body: JSON.stringify(sessionEvent("badsig", "checkout.session.completed", {})),
    });
    expect(res.status).toBe(401);
  });

  it("ber Stripe försöka igen när en betalning pekar på en order vi inte hittar", async () => {
    const event = sessionEvent("lost", "checkout.session.completed", {
      payment_status: "paid",
      metadata: { orderId: randomUUID(), site },
    });
    const first = await deliver(event);
    expect(first.status).toBe(404);
    // Samma händelse igen ska behandlas på nytt, inte sväljas som dubblett.
    const retry = await deliver(event);
    expect(retry.status).toBe(404);
    expect(await retry.json()).not.toMatchObject({ duplicate: true });
  });

  it("kvitterar en betalning som inte hör till oss", async () => {
    const res = await deliver(
      sessionEvent("foreign", "checkout.session.completed", { payment_status: "paid" })
    );
    expect(res.status).toBe(200);
  });

  it("kvitterar en betalning från en annan miljö på samma Stripe-konto", async () => {
    // Lokala testköp och produktion kan dela konto. Den andra miljöns ordrar
    // finns inte här, och ett fel-svar hade fått Stripe att försöka i dagar.
    const res = await deliver(
      sessionEvent("othersite", "checkout.session.completed", {
        payment_status: "paid",
        metadata: { orderId: randomUUID(), site: "http://localhost:3999" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("kvitterar en utgången session vars order inte finns", async () => {
    const res = await deliver(
      sessionEvent("expired", "checkout.session.expired", {
        payment_status: "unpaid",
        status: "expired",
        metadata: { orderId: randomUUID(), site },
      })
    );
    expect(res.status).toBe(200);
  });
});
