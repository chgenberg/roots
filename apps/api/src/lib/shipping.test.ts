import { describe, expect, it } from "vitest";
import {
  CreateCampaignSchema,
  ShippingSettingsSchema,
  goodsNetOre,
  isHomeDeliveryAvailable,
  oreLeftToFreeShipping,
  parseShippingSettings,
  shippingOreForOrder,
  type ShippingSettings,
} from "@roots/contracts";

const UNSET: ShippingSettings = { homeDeliveryFeeOre: null, freeShippingThresholdOre: null };
const FEE_ONLY: ShippingSettings = { homeDeliveryFeeOre: 5500, freeShippingThresholdOre: null };
const WITH_LIMIT: ShippingSettings = { homeDeliveryFeeOre: 5500, freeShippingThresholdOre: 69_800 };

describe("frakt vid hemleverans", () => {
  it("tar aldrig frakt vid samlad leverans till föreningen", () => {
    for (const s of [UNSET, FEE_ONLY, WITH_LIMIT]) {
      expect(shippingOreForOrder(s, { deliveryType: "BULK", goodsOre: 10_000 })).toBe(0);
    }
  });

  it("håller hemleverans stängd tills en avgift är bestämd", () => {
    expect(isHomeDeliveryAvailable(UNSET)).toBe(false);
    expect(shippingOreForOrder(UNSET, { deliveryType: "DIRECT", goodsOre: 39_900 })).toBeNull();
  });

  it("tar avgiften när ingen gräns för fri frakt finns", () => {
    expect(shippingOreForOrder(FEE_ONLY, { deliveryType: "DIRECT", goodsOre: 999_900 })).toBe(5500);
  });

  it("ger fri frakt när varuvärdet når gränsen, inte först över den", () => {
    // Premium 399 + Basic 299 = 698 kr ska nå en gräns på 698 kr.
    expect(shippingOreForOrder(WITH_LIMIT, { deliveryType: "DIRECT", goodsOre: 69_700 })).toBe(5500);
    expect(shippingOreForOrder(WITH_LIMIT, { deliveryType: "DIRECT", goodsOre: 39_900 + 29_900 })).toBe(0);
    expect(shippingOreForOrder(WITH_LIMIT, { deliveryType: "DIRECT", goodsOre: 79_800 })).toBe(0);
  });

  it("behandlar avgiften 0 som ett uttryckligt val av fri hemleverans", () => {
    const free: ShippingSettings = { homeDeliveryFeeOre: 0, freeShippingThresholdOre: null };
    expect(isHomeDeliveryAvailable(free)).toBe(true);
    expect(shippingOreForOrder(free, { deliveryType: "DIRECT", goodsOre: 100 })).toBe(0);
  });

  it("säger hur mycket som återstår till fri frakt", () => {
    expect(oreLeftToFreeShipping(WITH_LIMIT, 39_900)).toBe(29_900);
    expect(oreLeftToFreeShipping(WITH_LIMIT, 69_800)).toBeNull();
    expect(oreLeftToFreeShipping(FEE_ONLY, 39_900)).toBeNull();
    expect(oreLeftToFreeShipping(UNSET, 39_900)).toBeNull();
  });

  it("räknar en trasig eller saknad inställning som inte bestämd", () => {
    expect(parseShippingSettings(undefined)).toEqual(UNSET);
    expect(parseShippingSettings({ homeDeliveryFeeOre: "49" })).toEqual(UNSET);
    expect(parseShippingSettings({ homeDeliveryFeeOre: -100, freeShippingThresholdOre: null })).toEqual(UNSET);
    expect(parseShippingSettings(WITH_LIMIT)).toEqual(WITH_LIMIT);
  });

  it("tar bara emot hela kronor", () => {
    expect(ShippingSettingsSchema.safeParse({ homeDeliveryFeeOre: 4950, freeShippingThresholdOre: null }).success).toBe(false);
    expect(ShippingSettingsSchema.safeParse({ homeDeliveryFeeOre: 4900, freeShippingThresholdOre: 69_850 }).success).toBe(false);
    expect(ShippingSettingsSchema.safeParse({ homeDeliveryFeeOre: 4900, freeShippingThresholdOre: 69_800 }).success).toBe(true);
  });

  it("låter inte en kampanj bära egna fraktbelopp", () => {
    const parsed = CreateCampaignSchema.parse({
      name: "Vårförsäljning",
      goalValue: 10_000,
      startDate: "2027-03-01",
      endDate: "2027-03-31",
      deliveryType: "BOTH",
      shippingFeeOre: 0,
      shippingThresholdOre: 1,
    });
    expect(parsed).not.toHaveProperty("shippingFeeOre");
    expect(parsed).not.toHaveProperty("shippingThresholdOre");
  });
});

describe("varuvärdet som föreningens andel räknas på", () => {
  it("drar bort frakten", () => {
    expect(goodsNetOre({ totalOre: 45_400, shippingOre: 5500 })).toBe(39_900);
  });

  it("drar bort återbetalda varor men inte återbetald frakt en gång till", () => {
    // 399 kr varor + 55 kr frakt, allt återbetalt.
    expect(
      goodsNetOre({ totalOre: 45_400, shippingOre: 5500, refundedOre: 45_400, refundedShippingOre: 5500 })
    ).toBe(0);
    // Bara frakten återbetald: varuvärdet står kvar.
    expect(
      goodsNetOre({ totalOre: 45_400, shippingOre: 5500, refundedOre: 5500, refundedShippingOre: 5500 })
    ).toBe(39_900);
    // 100 kr av varorna återbetalda.
    expect(
      goodsNetOre({ totalOre: 45_400, shippingOre: 5500, refundedOre: 10_000, refundedShippingOre: 0 })
    ).toBe(29_900);
  });

  it("blir aldrig negativt", () => {
    expect(goodsNetOre({ totalOre: 10_000, shippingOre: 0, refundedOre: 99_999 })).toBe(0);
  });
});
