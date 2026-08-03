import { z } from "zod";
import { router, publicProcedure } from "../init";
import { isAuthenticated } from "../middleware/auth";
import { TRPCError } from "@trpc/server";
import {
  chatCompletion,
  isAiConfigured,
  type ChatMessage,
} from "../../lib/ai/openclaw-client";
import { buildSystemPrompt } from "../../lib/ai/system-prompt";
import { recordAiUsage, recordAiIncident } from "../../lib/ai/usage";
import { scrubPiiText } from "../../lib/ai/pii";
import { checkMedicalClaims, CLAIMS_BLOCKED_REPLY } from "../../lib/ai/claims-guard";
import { aiRateLimit, aiGlobalChatDailyCap } from "../../lib/rate-limit";
import { flags } from "../../lib/flags";

const authedProcedure = publicProcedure.use(isAuthenticated);

const DISCLAIMER = "AI-genererat svar — verifiera viktig information";

export const aiRouter = router({
  chat: authedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        conversationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // P3.39 (audit 2026-05-26): tidigare returnerade detta endpoint
      // alltid en hardcoded "not activated"-text även när OpenAI var
      // konfigurerat — vilket är en misvisande tRPC-yta vid sidan av
      // den fungerande REST-rutten /v1/ai/chat. Vi proxy:ar nu till
      // samma chatCompletion-pipeline.
      const conversationId = input.conversationId ?? crypto.randomUUID();
      const session = (ctx as { session?: { userId?: string; role?: string; orgId?: string | null; demoProfile?: { name?: string } } }).session;
      const userId = session?.userId ?? null;
      const orgId = session?.orgId ?? null;
      const surface = "portal_chat_trpc";

      // Pre-push fix 2026-05-26: REST-rutten /v1/ai/chat har
      // aiRateLimit(userId) (30/min). tRPC-mutationen saknade det
      // helt vilket gjorde att en autentiserad klient kunde spamma
      // OpenAI via tRPC och bypass:a kostnadsskyddet.
      if (userId) {
        const rl = await aiRateLimit(userId);
        if (!rl.allowed) {
          recordAiIncident({
            surface,
            kind: "rate_limited",
            userId,
            orgId,
            meta: { retryInSeconds: rl.resetInSeconds },
          });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `För många frågor på kort tid. Vänta ${rl.resetInSeconds}s.`,
          });
        }
      }

      // Samma globala dygnstak som REST-rutterna. Utan det här var tRPC
      // en dörr rakt förbi kostnadsskyddet: per-user-gränsen räcker inte
      // när det är antalet användare som är variabeln.
      const globalCap = await aiGlobalChatDailyCap();
      if (!globalCap.allowed) {
        recordAiIncident({
          surface,
          kind: "rate_limited",
          userId,
          orgId,
          meta: { reason: "global_daily_cap" },
        });
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "AI-assistenten har nått dagens kapacitetstak. Försök igen efter midnatt.",
        });
      }

      if (!flags.aiEnabled() || !isAiConfigured()) {
        recordAiIncident({
          surface,
          kind: "fallback",
          userId,
          orgId,
          meta: { reason: !flags.aiEnabled() ? "kill_switch" : "not_configured" },
        });
        return {
          reply:
            "AI-assistenten är inte aktiverad just nu. Kontakta support för hjälp.",
          conversationId,
          disclaimer: DISCLAIMER,
          fallback: true,
        };
      }

      try {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: buildSystemPrompt(
              session?.role ?? "GUEST",
              session?.demoProfile?.name
            ),
          },
          // REST-rutterna skrubbade PII innan de skickade vidare till
          // OpenAI, tRPC-vägen gjorde det inte — samma fråga läckte
          // alltså personnummer eller telefon beroende på vilken klient
          // som råkade ställa den.
          { role: "user", content: scrubPiiText(input.message) },
        ];
        const response = await chatCompletion(messages);
        recordAiUsage({
          surface,
          model: response.model,
          promptTokens: response.usage?.promptTokens,
          completionTokens: response.usage?.completionTokens,
          userId,
          orgId,
        });
        const claims = checkMedicalClaims(response.content);
        if (!claims.ok) {
          recordAiIncident({
            surface,
            kind: "claims_blocked",
            userId,
            orgId,
            meta: { matched: claims.matched ?? null },
          });
          return {
            reply: CLAIMS_BLOCKED_REPLY,
            conversationId,
            disclaimer: DISCLAIMER,
          };
        }
        return {
          reply: response.content,
          conversationId,
          disclaimer: DISCLAIMER,
          model: response.model,
        };
      } catch (err) {
        recordAiIncident({
          surface,
          kind: "upstream_error",
          status: (err as { status?: number })?.status,
          userId,
          orgId,
          meta: { message: (err as Error)?.message },
        });
        return {
          reply:
            "AI-assistenten är inte tillgänglig just nu. Försök igen eller maila hej@roots.se.",
          conversationId,
          disclaimer: DISCLAIMER,
          fallback: true,
        };
      }
    }),

  status: publicProcedure.query(async () => {
    // P4.15 (audit 2026-05-26): respektera AI_ENABLED kill-switch.
    return {
      enabled: flags.aiEnabled() && isAiConfigured(),
      provider: "OpenAI",
    };
  }),
});
