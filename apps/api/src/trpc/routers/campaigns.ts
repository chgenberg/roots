import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { isAuthenticated, isTeamLeader, isAssociationAdmin, notDemo } from "../middleware/auth";
import { db } from "@roots/db";
import {
  campaigns,
  teams,
  teamGoals,
  sellers,
  organizations,
} from "@roots/db/schema";
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  SetTeamGoalSchema,
} from "@roots/contracts";
import { isOrgApprovedForPublicSales } from "../../lib/org-approval";
import { uiError } from "../../lib/ui-locale";

const protectedProcedure = publicProcedure.use(isAuthenticated);
const teamLeaderProcedure = publicProcedure.use(isTeamLeader);
const associationProcedure = publicProcedure.use(isAssociationAdmin);
// Scout fix 2026-05-26 (Auth-C2): mutations använder *Mutation-varianten
// som även blockerar demo-konton (notDemo middleware).
const teamLeaderMutation = teamLeaderProcedure.use(notDemo);
const associationMutation = associationProcedure.use(notDemo);

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    crypto.randomUUID().slice(0, 6)
  );
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

async function verifyCampaignOwnership(
  campaignId: string,
  orgId: string,
  locale: Parameters<typeof uiError>[0]
) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: uiError(locale, "campaignNotFound"),
    });
  }

  if (campaign.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: uiError(locale, "permissionDeniedForCampaign"),
    });
  }

  return campaign;
}

async function verifyTeamOwnership(
  teamId: string,
  orgId: string,
  locale: Parameters<typeof uiError>[0]
) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: uiError(locale, "teamNotFoundShort"),
    });
  }

  if (team.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: uiError(locale, "permissionDeniedForTeam"),
    });
  }

  return team;
}

export const campaignsRouter = router({
  create: associationMutation
    .input(CreateCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      const [campaign] = await db
        .insert(campaigns)
        .values({
          orgId: ctx.orgId,
          name: input.name,
          slug,
          description: input.description || "",
          story: input.story || "",
          goalType: input.goalType,
          goalValue: input.goalValue,
          startDate: input.startDate,
          endDate: input.endDate,
          deliveryDate: input.deliveryDate ?? null,
          allowSalesOutsidePeriod: input.allowSalesOutsidePeriod,
          deliveryType: input.deliveryType,
          shippingThresholdOre: input.shippingThresholdOre ?? 0,
          shippingFeeOre: input.shippingFeeOre ?? 4900,
          marginPercent: input.marginPercent,
        })
        .returning();

      return campaign;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: uiError(ctx.locale, "noOrganisationOnSession"),
        });
      }

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) return null;

      if (campaign.orgId !== ctx.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: uiError(ctx.locale, "permissionDenied"),
        });
      }

      return campaign;
    }),

  listByOrg: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.orgId) return [];
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.orgId, ctx.orgId))
      .orderBy(campaigns.createdAt);
  }),

  update: associationMutation
    .input(
      UpdateCampaignSchema.extend({
        id: z.string().uuid(),
        status: z.enum(["DRAFT", "ACTIVE", "ENDED", "SETTLED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Samma spärr som i activate — annars vore `update({ status: "ACTIVE" })`
      // en väg runt den.
      if (
        updates.status === "ACTIVE" &&
        !(await isOrgApprovedForPublicSales(ctx.orgId))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: uiError(ctx.locale, "orgNotApprovedForPublicSales"),
        });
      }

      const [updated] = await db
        .update(campaigns)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(campaigns.id, id), eq(campaigns.orgId, ctx.orgId)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: uiError(ctx.locale, "campaignNotFoundThe"),
        });
      }

      return updated;
    }),

  activate: associationMutation
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Här står användaren när hen vill gå live, så det är här
      // felmeddelandet gör mest nytta. Kassan har samma spärr som backstop.
      if (!(await isOrgApprovedForPublicSales(ctx.orgId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: uiError(ctx.locale, "orgNotApprovedForPublicSales"),
        });
      }

      const [updated] = await db
        .update(campaigns)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(
          and(eq(campaigns.id, input.id), eq(campaigns.orgId, ctx.orgId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: uiError(ctx.locale, "campaignNotFoundThe"),
        });
      }

      return updated;
    }),
});

export const teamsRouter = router({
  create: teamLeaderMutation
    .input(
      z.object({
        name: z.string().min(2),
        campaignId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyCampaignOwnership(input.campaignId, ctx.orgId, ctx.locale);

      const inviteToken = generateToken();

      const [team] = await db
        .insert(teams)
        .values({
          orgId: ctx.orgId,
          campaignId: input.campaignId,
          leaderId: ctx.userId,
          name: input.name,
          inviteToken,
        })
        .returning();

      return { ...team, inviteToken };
    }),

  // En inbjudningslänk är i praktiken ett lösenord: den som har den kan
  // registrera ett säljarkonto i laget. Därför ligger den inte i
  // listsvaret, och listan är stängd för SELLER — annars kunde en säljare
  // skörda alla lagens tokens. Ledare hämtar sin egen token via
  // teams.create, teams.regenerateInviteToken eller /v1/dashboard.
  listByCampaign: teamLeaderProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifyCampaignOwnership(input.campaignId, ctx.orgId!, ctx.locale);

      const teamList = await db
        .select({
          id: teams.id,
          name: teams.name,
          memberCount: teams.memberCount,
          leaderId: teams.leaderId,
          createdAt: teams.createdAt,
        })
        .from(teams)
        .where(eq(teams.campaignId, input.campaignId));

      return teamList;
    }),

  getByInviteToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          orgId: teams.orgId,
          campaignId: teams.campaignId,
        })
        .from(teams)
        .where(eq(teams.inviteToken, input.token))
        .limit(1);

      if (!team) return null;

      const [campaign] = await db
        .select({ name: campaigns.name, story: campaigns.story })
        .from(campaigns)
        .where(eq(campaigns.id, team.campaignId))
        .limit(1);

      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, team.orgId))
        .limit(1);

      return {
        ...team,
        campaignName: campaign?.name || "",
        campaignStory: campaign?.story || "",
        orgName: org?.name || "",
      };
    }),

  setGoal: associationMutation
    .input(SetTeamGoalSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyCampaignOwnership(input.campaignId, ctx.orgId, ctx.locale);
      await verifyTeamOwnership(input.teamId, ctx.orgId, ctx.locale);

      const [goal] = await db
        .insert(teamGoals)
        .values({
          teamId: input.teamId,
          campaignId: input.campaignId,
          goalType: input.goalType,
          goalValue: input.goalValue,
        })
        .onConflictDoUpdate({
          target: [teamGoals.teamId, teamGoals.campaignId],
          set: {
            goalType: input.goalType,
            goalValue: input.goalValue,
          },
        })
        .returning();

      return goal;
    }),

  regenerateInviteToken: teamLeaderMutation
    .input(z.object({ teamId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTeamOwnership(input.teamId, ctx.orgId, ctx.locale);

      const newToken = generateToken();

      const [updated] = await db
        .update(teams)
        .set({ inviteToken: newToken, updatedAt: new Date() })
        .where(
          and(eq(teams.id, input.teamId), eq(teams.leaderId, ctx.userId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: uiError(ctx.locale, "teamNotFoundOrNoPermission"),
        });
      }

      return updated;
    }),
});

export const sellersRouter = router({
  listByTeam: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifyTeamOwnership(input.teamId, ctx.orgId!, ctx.locale);

      const sellerList = await db
        .select({
          id: sellers.id,
          displayName: sellers.displayName,
          shopSlug: sellers.shopSlug,
          individualGoal: sellers.individualGoal,
          status: sellers.status,
          userId: sellers.userId,
          createdAt: sellers.createdAt,
        })
        .from(sellers)
        .where(eq(sellers.teamId, input.teamId));

      return sellerList;
    }),

  getMyShop: protectedProcedure.query(async ({ ctx }) => {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, ctx.userId))
      .limit(1);

    if (!seller) return null;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, seller.campaignId))
      .limit(1);

    return {
      ...seller,
      teamName: team?.name || "",
      campaignName: campaign?.name || "",
      campaignStory: campaign?.story || "",
    };
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [seller] = await db
        .select()
        .from(sellers)
        .where(eq(sellers.shopSlug, input.slug))
        .limit(1);

      if (!seller) return null;

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, seller.teamId))
        .limit(1);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, seller.campaignId))
        .limit(1);

      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, team?.orgId || ""))
        .limit(1);

      return {
        id: seller.id,
        displayName: seller.displayName,
        shopSlug: seller.shopSlug,
        teamName: team?.name || "",
        campaignName: campaign?.name || "",
        campaignStory: campaign?.story || "",
        orgName: org?.name || "",
        campaignId: seller.campaignId,
        teamId: seller.teamId,
        individualGoal: seller.individualGoal,
      };
    }),
});
