import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { isAuthenticated } from "../middleware/auth";
import { LoginSchema, RegisterClubSchema } from "@roots/contracts";
import { hashPassword, verifyPassword, isPasswordAcceptable } from "../../lib/password";
import { createSession, destroySession } from "../../lib/session";
import { loginRateLimit } from "../../lib/rate-limit";
import { generateMfaSecret } from "../../lib/mfa";

const authedProcedure = publicProcedure.use(isAuthenticated);

export const authRouter = router({
  login: publicProcedure.input(LoginSchema).mutation(async ({ input, ctx }) => {
    const rateLimit = await loginRateLimit(ctx.ip, input.email);
    if (!rateLimit.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many login attempts. Try again in ${Math.ceil(rateLimit.resetInSeconds / 60)} minutes.`,
      });
    }

    // DB lookup will be wired when connected to live database
    // Stub: return session creation for known demo emails
    const demoUsers: Record<
      string,
      { id: string; role: string; orgId: string; hash: string }
    > = {};

    const user = demoUsers[input.email];
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const valid = await verifyPassword(user.hash, input.password);
    if (!valid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const sessionId = await createSession({
      userId: user.id,
      role: user.role as "CLUB_ADMIN",
      orgId: user.orgId,
      createdAt: Date.now(),
    });

    return { success: true as const, sessionId, role: user.role };
  }),

  logout: authedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) {
      await destroySession(ctx.sessionId);
    }
    return { success: true };
  }),

  register: publicProcedure
    .input(RegisterClubSchema)
    .mutation(async ({ input }) => {
      const check = isPasswordAcceptable(input.password);
      if (!check.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: check.reason!,
        });
      }

      const _passwordHash = await hashPassword(input.password);

      // Will create org + user with status 'pending' when DB is connected
      return {
        success: true as const,
        message: "Registration submitted. We will review your application within 24 hours.",
      };
    }),

  me: authedProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.userId,
      role: ctx.role,
      orgId: ctx.orgId,
    };
  }),

  setupMfa: authedProcedure.mutation(async ({ ctx }) => {
    const { secret, uri } = generateMfaSecret(ctx.userId);
    // Will save secret to user record when DB is connected
    return { secret, uri };
  }),

  verifyMfa: authedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      // Will fetch secret from DB
      // Stub: MFA not configured yet
      return { verified: false, message: "MFA not configured for this account" };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Will send email via transactional email service
      return {
        success: true,
        message: "If the email exists, a reset link was sent",
      };
    }),
});
