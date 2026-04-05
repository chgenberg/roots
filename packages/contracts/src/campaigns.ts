import { z } from "zod";

export const CampaignStatusEnum = z.enum([
  "DRAFT",
  "ACTIVE",
  "ENDED",
  "SETTLED",
]);

export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const CampaignGoalTypeEnum = z.enum(["AMOUNT", "PACKAGES"]);
export type CampaignGoalType = z.infer<typeof CampaignGoalTypeEnum>;

export const DeliveryTypeEnum = z.enum(["BULK", "DIRECT", "BOTH"]);
export type DeliveryType = z.infer<typeof DeliveryTypeEnum>;

export const CreateCampaignSchema = z.object({
  name: z.string().min(2, "Kampanjnamn krävs"),
  description: z.string().optional(),
  story: z.string().optional(),
  goalType: CampaignGoalTypeEnum.default("AMOUNT"),
  goalValue: z.number().int().positive("Mål måste vara positivt"),
  startDate: z.string(),
  endDate: z.string(),
  deliveryType: DeliveryTypeEnum.default("BULK"),
  shippingThresholdOre: z.number().int().optional(),
  shippingFeeOre: z.number().int().optional(),
  marginPercent: z.number().int().min(0).max(100).default(25),
});

export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = CreateCampaignSchema.partial();
export type UpdateCampaign = z.infer<typeof UpdateCampaignSchema>;

export const CreateTeamSchema = z.object({
  name: z.string().min(2, "Lagnamn krävs"),
  campaignId: z.string().uuid(),
});

export type CreateTeam = z.infer<typeof CreateTeamSchema>;

export const SetTeamGoalSchema = z.object({
  teamId: z.string().uuid(),
  campaignId: z.string().uuid(),
  goalType: z.enum(["AMOUNT", "PACKAGES"]).default("AMOUNT"),
  goalValue: z.number().int().positive(),
});

export type SetTeamGoal = z.infer<typeof SetTeamGoalSchema>;

export const JoinAsSellerSchema = z.object({
  inviteToken: z.string(),
  displayName: z.string().min(2, "Namn krävs"),
});

export type JoinAsSeller = z.infer<typeof JoinAsSellerSchema>;

export const CustomerOrderStatusEnum = z.enum([
  "DRAFT",
  "PENDING",
  "PAID",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
]);

export type CustomerOrderStatus = z.infer<typeof CustomerOrderStatusEnum>;

export const CustomerPaymentMethodEnum = z.enum([
  "KLARNA",
  "DIRECT_TO_LEADER",
]);

export type CustomerPaymentMethod = z.infer<typeof CustomerPaymentMethodEnum>;

export const PayoutStatusEnum = z.enum([
  "PENDING",
  "INVOICED",
  "PAID",
]);

export type PayoutStatus = z.infer<typeof PayoutStatusEnum>;

export const CreateCustomerOrderSchema = z.object({
  sellerSlug: z.string(),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  deliveryType: z.enum(["BULK", "DIRECT"]).default("BULK"),
  shippingAddressLine1: z.string().optional(),
  shippingAddressLine2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
  note: z.string().optional(),
});

export type CreateCustomerOrder = z.infer<typeof CreateCustomerOrderSchema>;
