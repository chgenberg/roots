import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create } };
  },
}));

import { createCheckoutSession } from "./stripe";

describe("createCheckoutSession", () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_dummy";
    create.mockReset();
    create.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/cs_test_1",
    });
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  it("tar alltid betalt i kronor och stänger av Adaptive Pricing", async () => {
    await createCheckoutSession({
      orderId: "order-1",
      customerEmail: "kund@example.com",
      locale: "sv",
      lineItems: [{ name: "Roots Premiumpaket", quantity: 2, unitAmountOre: 39_900 }],
      successUrl: "https://roots.nu/ok",
      cancelUrl: "https://roots.nu/avbrutet",
      metadata: { site: "https://roots.nu" },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0];
    expect(params.currency).toBe("sek");
    expect(params.adaptive_pricing).toEqual({ enabled: false });
    expect(
      params.line_items.every(
        (line: { price_data: { currency: string } }) =>
          line.price_data.currency === "sek"
      )
    ).toBe(true);
  });
});
