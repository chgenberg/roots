import { TRPCError } from "@trpc/server";
import { middleware } from "../init";
import type { Role } from "@roots/contracts";
import {
  CLUB_ROLES,
  SALES_ROLES,
  ADMIN_ROLES,
  FUNDRAISING_ROLES,
} from "@roots/contracts";

export const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      role: ctx.role as Role,
      orgId: ctx.orgId,
      sessionId: ctx.sessionId,
    },
  });
});

export const isClubUser = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !CLUB_ROLES.includes(ctx.role as Role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Club access required" });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

export const isSalesUser = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !SALES_ROLES.includes(ctx.role as Role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sales access required",
    });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

export const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ADMIN_ROLES.includes(ctx.role as Role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

export const isAssociationAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || ctx.role !== "ASSOCIATION_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Association admin access required",
    });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

export const isTeamLeader = middleware(async ({ ctx, next }) => {
  if (
    !ctx.userId ||
    (ctx.role !== "TEAM_LEADER" && ctx.role !== "ASSOCIATION_ADMIN")
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Team leader access required",
    });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

export const isFundraisingUser = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !FUNDRAISING_ROLES.includes(ctx.role as Role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Fundraising access required",
    });
  }
  return next({
    ctx: { userId: ctx.userId, role: ctx.role as Role, orgId: ctx.orgId!, sessionId: ctx.sessionId },
  });
});

// Scout fix 2026-05-26 (Auth-C2): blockera demo-konton från
// muterande tRPC-anrop (campaigns.create/update/activate,
// teams.create/setGoal/regenerateInviteToken etc.). Vi använder
// `next()` utan ctx-argument så att föregående middlewares
// non-null-narrowing (orgId/userId) bevaras. Att explicit
// återskicka `ctx` skulle bryta typningen.
export const notDemo = middleware(async ({ ctx, next }) => {
  if (ctx.isDemo) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Demo-konton kan inte utföra denna åtgärd.",
    });
  }
  return next();
});
