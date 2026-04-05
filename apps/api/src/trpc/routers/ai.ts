import { z } from "zod";
import { router, publicProcedure } from "../init";
import { isAuthenticated } from "../middleware/auth";

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
      // BFF proxy to Open Claw will be implemented in Phase 7
      // For now return a stub response
      return {
        reply:
          "AI-assistenten ar inte aktiverad annu. Kontakta support for hjalp.",
        conversationId: input.conversationId ?? crypto.randomUUID(),
        disclaimer: "AI-genererat svar -- verifiera viktig information",
      };
    }),

  status: publicProcedure.query(async () => {
    const key = process.env.OPENAI_API_KEY || "";
    const enabled = !!key && !key.includes("REPLACE-ME");
    return { enabled, provider: "OpenAI" };
  }),
});
