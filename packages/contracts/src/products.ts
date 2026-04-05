import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceOre: z.number().int().positive(),
  currency: z.string().default("SEK"),
  active: z.boolean().default(true),
});

export type Product = z.infer<typeof ProductSchema>;

export const BundleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  priceOre: z.number().int().positive(),
  products: z.array(ProductSchema),
});

export type Bundle = z.infer<typeof BundleSchema>;
