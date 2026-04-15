import { z } from "zod";
import { router, publicProcedure } from "../init";
import { isAuthenticated } from "../middleware/auth";
import { isAiConfigured } from "../../lib/ai/openclaw-client";

const authedProcedure = publicProcedure.use(isAuthenticated);

export const aiRouter = router({
  chat: authedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        conversationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiConfigured()) {
        return {
          reply:
            "AI-assistenten är inte aktiverad just nu. Kontakta support för hjälp.",
          conversationId: input.conversationId ?? crypto.randomUUID(),
          disclaimer: "AI-genererat svar — verifiera viktig information",
          fallback: true,
        };
      }

      return {
        reply:
          "AI-assistenten är inte aktiverad ännu. Kontakta support för hjälp.",
        conversationId: input.conversationId ?? crypto.randomUUID(),
        disclaimer: "AI-genererat svar — verifiera viktig information",
      };
    }),

  status: publicProcedure.query(async () => {
    return {
      enabled: isAiConfigured(),
      provider: "OpenAI",
    };
  }),
});
