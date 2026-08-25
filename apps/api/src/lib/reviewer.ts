import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { users } from "@roots/db/schema";
import { isReviewerEmail } from "@roots/contracts";
import type { Context } from "hono";
import { requireSession } from "./http-session";

export type ReviewerUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export function isReviewer(
  user: { email: string; role?: string | null } | null | undefined
): boolean {
  return Boolean(user && isReviewerEmail(user.email));
}

export async function requireReviewer(c: Context): Promise<ReviewerUser | null> {
  const session = await requireSession(c);
  if (!session?.userId) return null;
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      contactName: users.contactName,
      role: users.role,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || user.deletedAt) return null;
  if (!isReviewer(user)) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.contactName || user.email,
    role: user.role,
  };
}
