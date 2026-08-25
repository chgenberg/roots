import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { users } from "@roots/db/schema";
import { router, publicProcedure } from "../init";
import { isAuthenticated } from "../middleware/auth";
import { destroySession } from "../../lib/session";

const authedProcedure = publicProcedure.use(isAuthenticated);

/**
 * Inloggning, registrering, lösenordsbyte och kontoradering ligger i
 * REST-routern (src/routes/auth.ts) — det är den webben och middleware:n
 * använder. Här finns bara `me`, som webbens middleware slår mot för att
 * rollskydda /forening, /lag, /min-shop och /portal.
 *
 * Tidigare fanns även login/register/setupMfa/verifyMfa/requestPasswordReset
 * här som stubbar. De var inte kopplade till databasen: `register` svarade
 * "Registration submitted" utan att skapa något konto och
 * `requestPasswordReset` svarade "a reset link was sent" utan att skicka
 * mejl. De är borttagna hellre än att ligga kvar och ljuga för en anropare.
 */
export const authRouter = router({
  me: authedProcedure.query(async ({ ctx }) => {
    let email = "";
    if (ctx.userId) {
      try {
        const [row] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1);
        email = row?.email ?? "";
      } catch {
        // Middleware can still authorize on role if the lookup blinks.
      }
    }
    return {
      userId: ctx.userId,
      role: ctx.role,
      orgId: ctx.orgId,
      email,
    };
  }),

  logout: authedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) {
      await destroySession(ctx.sessionId);
    }
    return { success: true };
  }),
});
