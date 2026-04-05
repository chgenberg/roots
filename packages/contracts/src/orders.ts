import { z } from "zod";

export const OrderStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const InvoiceStatusEnum = z.enum([
  "NONE",
  "PENDING",
  "ISSUED",
  "PAID",
  "CANCELLED",
]);

export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

export const QuoteStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
]);

export type QuoteStatus = z.infer<typeof QuoteStatusEnum>;

export const CreateOrderLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
});

export const CreateOrderSchema = z.object({
  bundleId: z.string().uuid().optional(),
  lines: z.array(CreateOrderLineSchema).min(1),
  idempotencyKey: z.string().uuid(),
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;
