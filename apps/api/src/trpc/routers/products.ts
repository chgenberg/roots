import { z } from "zod";
import { router, publicProcedure } from "../init";

export const productsRouter = router({
  list: publicProcedure.query(async () => {
    // DB integration will be wired in Phase 3
    return [
      {
        id: "1",
        sku: "ROOTS-SH-001",
        name: "Roots Shampoo",
        slug: "shampoo",
        description: "Naturligt schampo med nordiska botaniska extrakt.",
        priceOre: 14900,
        currency: "SEK",
        active: true,
      },
      {
        id: "2",
        sku: "ROOTS-CO-001",
        name: "Roots Conditioner",
        slug: "conditioner",
        description: "Naturligt balsam for mjukt och hanterbart har.",
        priceOre: 14900,
        currency: "SEK",
        active: true,
      },
      {
        id: "3",
        sku: "ROOTS-BW-001",
        name: "Roots Body Wash",
        slug: "body-wash",
        description: "Naturlig kroppstvatt med skonsam rengoring.",
        priceOre: 12900,
        currency: "SEK",
        active: true,
      },
    ];
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const all = [
        {
          id: "1",
          sku: "ROOTS-SH-001",
          name: "Roots Shampoo",
          slug: "shampoo",
          description: "Naturligt schampo med nordiska botaniska extrakt.",
          priceOre: 14900,
          currency: "SEK",
          active: true,
        },
        {
          id: "2",
          sku: "ROOTS-CO-001",
          name: "Roots Conditioner",
          slug: "conditioner",
          description: "Naturligt balsam for mjukt och hanterbart har.",
          priceOre: 14900,
          currency: "SEK",
          active: true,
        },
        {
          id: "3",
          sku: "ROOTS-BW-001",
          name: "Roots Body Wash",
          slug: "body-wash",
          description: "Naturlig kroppstvatt med skonsam rengoring.",
          priceOre: 12900,
          currency: "SEK",
          active: true,
        },
      ];
      return all.find((p) => p.slug === input.slug) ?? null;
    }),
});
