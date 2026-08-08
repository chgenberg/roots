import type { UiLocale } from "./ui-locale";

interface MilestoneDef {
  id: string;
  thresholdOre?: number;
  thresholdPackages?: number;
}

interface Milestone {
  id: string;
  label: string;
  description: string;
  thresholdOre?: number;
  thresholdPackages?: number;
}

export type SellerGrade = "starter" | "bronze" | "silver" | "gold" | "diamond";

interface GradeDef {
  grade: SellerGrade;
  thresholdOre: number;
}

const GRADE_TIERS: GradeDef[] = [
  { grade: "diamond", thresholdOre: 1500000 },
  { grade: "gold", thresholdOre: 700000 },
  { grade: "silver", thresholdOre: 300000 },
  { grade: "bronze", thresholdOre: 100000 },
  { grade: "starter", thresholdOre: 0 },
];

const GRADE_LABELS: Record<SellerGrade, Record<UiLocale, string>> = {
  diamond: { sv: "Diamant", en: "Diamond" },
  gold: { sv: "Guld", en: "Gold" },
  silver: { sv: "Silver", en: "Silver" },
  bronze: { sv: "Brons", en: "Bronze" },
  starter: { sv: "Starter", en: "Starter" },
};

const MILESTONE_COPY: Record<
  string,
  Record<UiLocale, { label: string; description: string }>
> = {
  first_sale: {
    sv: {
      label: "Första försäljningen!",
      description: "Du har gjort din första försäljning. Bra start!",
    },
    en: {
      label: "First sale!",
      description: "You have made your first sale. Great start!",
    },
  },
  "5_packages": {
    sv: {
      label: "5 paket sålda",
      description: "Fantastiskt! Du har sålt 5 paket.",
    },
    en: {
      label: "5 packages sold",
      description: "Fantastic! You have sold 5 packages.",
    },
  },
  "10_packages": {
    sv: {
      label: "10 paket sålda",
      description: "Dubbla siffror! 10 paket sålda.",
    },
    en: {
      label: "10 packages sold",
      description: "Double digits! 10 packages sold.",
    },
  },
  "5000_sek": {
    sv: {
      label: "5 000 kr",
      description: "Ni har passerat 5 000 kr i försäljning!",
    },
    en: {
      label: "SEK 5,000",
      description: "You have passed SEK 5,000 in sales!",
    },
  },
  halfway: {
    sv: {
      label: "Halvvägs!",
      description: "Ni är halvvägs till målet. Fortsätt!",
    },
    en: {
      label: "Halfway!",
      description: "You are halfway to the goal. Keep going!",
    },
  },
  "25_packages": {
    sv: {
      label: "25 paket sålda",
      description: "Imponerande! 25 paket sålda.",
    },
    en: {
      label: "25 packages sold",
      description: "Impressive! 25 packages sold.",
    },
  },
  "10000_sek": {
    sv: {
      label: "10 000 kr",
      description: "Fantastiskt! Över 10 000 kr!",
    },
    en: {
      label: "SEK 10,000",
      description: "Fantastic! Over SEK 10,000!",
    },
  },
  "50_packages": {
    sv: {
      label: "50 paket sålda",
      description: "50 paket! Ni är en riktig säljmaskin!",
    },
    en: {
      label: "50 packages sold",
      description: "50 packages! You are a real sales machine!",
    },
  },
  goal_reached: {
    sv: {
      label: "Mål uppnått!",
      description: "Grattis! Ni har nått ert försäljningsmål!",
    },
    en: {
      label: "Goal reached!",
      description: "Congratulations! You have reached your sales goal!",
    },
  },
};

/** Threshold definitions (copy is locale-dependent). */
export const MILESTONE_DEFS: MilestoneDef[] = [
  { id: "first_sale", thresholdOre: 1 },
  { id: "5_packages", thresholdPackages: 5 },
  { id: "10_packages", thresholdPackages: 10 },
  { id: "5000_sek", thresholdOre: 500000 },
  { id: "halfway" },
  { id: "25_packages", thresholdPackages: 25 },
  { id: "10000_sek", thresholdOre: 1000000 },
  { id: "50_packages", thresholdPackages: 50 },
  { id: "goal_reached" },
];

/** @deprecated Prefer MILESTONE_DEFS + localizeMilestone — kept for callers that only need ids/thresholds. */
export const MILESTONES: Milestone[] = MILESTONE_DEFS.map((m) => {
  const copy = MILESTONE_COPY[m.id]?.sv ?? {
    label: m.id,
    description: m.id,
  };
  return { ...m, ...copy };
});

function localizeMilestone(def: MilestoneDef, locale: UiLocale): Milestone {
  const copy = MILESTONE_COPY[def.id]?.[locale] ??
    MILESTONE_COPY[def.id]?.sv ?? { label: def.id, description: def.id };
  return { ...def, ...copy };
}

function formatPackagesLeft(n: number, locale: UiLocale): string {
  return locale === "en" ? `${n} packages left` : `${n} paket kvar`;
}

function formatAmountLeft(ore: number, locale: UiLocale): string {
  const amount = (ore / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE"
  );
  return locale === "en" ? `SEK ${amount} left` : `${amount} kr kvar`;
}

export function getSellerGrade(
  totalSalesOre: number,
  locale: UiLocale = "sv"
): {
  grade: SellerGrade;
  label: string;
  thresholdOre: number;
  nextGrade: { grade: SellerGrade; label: string; remainingOre: number } | null;
} {
  let current = GRADE_TIERS[GRADE_TIERS.length - 1];
  let nextTier: GradeDef | null = null;

  for (let i = 0; i < GRADE_TIERS.length; i++) {
    if (totalSalesOre >= GRADE_TIERS[i].thresholdOre) {
      current = GRADE_TIERS[i];
      nextTier = i > 0 ? GRADE_TIERS[i - 1] : null;
      break;
    }
  }

  return {
    grade: current.grade,
    label: GRADE_LABELS[current.grade][locale],
    thresholdOre: current.thresholdOre,
    nextGrade: nextTier
      ? {
          grade: nextTier.grade,
          label: GRADE_LABELS[nextTier.grade][locale],
          remainingOre: nextTier.thresholdOre - totalSalesOre,
        }
      : null,
  };
}

interface MilestoneGoalContext {
  goalOre?: number;
  goalPackages?: number;
}

function isHalfwayAchieved(
  totalSalesOre: number,
  orderCount: number,
  ctx: MilestoneGoalContext
): boolean {
  if (ctx.goalPackages) return orderCount >= ctx.goalPackages / 2;
  if (ctx.goalOre) return totalSalesOre >= ctx.goalOre / 2;
  return false;
}

function isGoalReached(
  totalSalesOre: number,
  orderCount: number,
  ctx: MilestoneGoalContext
): boolean {
  if (ctx.goalPackages) return orderCount >= ctx.goalPackages;
  if (ctx.goalOre) return totalSalesOre >= ctx.goalOre;
  return false;
}

export function getAchievedMilestones(
  totalSalesOre: number,
  orderCount: number,
  goalOre?: number,
  goalPackages?: number,
  locale: UiLocale = "sv"
): Milestone[] {
  const achieved: Milestone[] = [];
  const ctx: MilestoneGoalContext = { goalOre, goalPackages };
  const specialIds = new Set(["first_sale", "halfway", "goal_reached"]);

  for (const def of MILESTONE_DEFS) {
    const m = localizeMilestone(def, locale);
    if (m.id === "first_sale" && orderCount >= 1) {
      achieved.push(m);
    } else if (
      m.id === "halfway" &&
      isHalfwayAchieved(totalSalesOre, orderCount, ctx)
    ) {
      achieved.push(m);
    } else if (
      m.id === "goal_reached" &&
      isGoalReached(totalSalesOre, orderCount, ctx)
    ) {
      achieved.push(m);
    } else if (
      !specialIds.has(m.id) &&
      m.thresholdOre &&
      totalSalesOre >= m.thresholdOre
    ) {
      achieved.push(m);
    } else if (
      !specialIds.has(m.id) &&
      m.thresholdPackages &&
      orderCount >= m.thresholdPackages
    ) {
      achieved.push(m);
    }
  }

  return achieved;
}

export function getNextMilestone(
  totalSalesOre: number,
  orderCount: number,
  goalOre?: number,
  goalPackages?: number,
  locale: UiLocale = "sv"
): { id: string; label: string; remaining: string } | null {
  const achieved = getAchievedMilestones(
    totalSalesOre,
    orderCount,
    goalOre,
    goalPackages,
    locale
  );
  const achievedIds = new Set(achieved.map((m) => m.id));
  const ctx: MilestoneGoalContext = { goalOre, goalPackages };

  for (const def of MILESTONE_DEFS) {
    if (achievedIds.has(def.id)) continue;
    const m = localizeMilestone(def, locale);

    if (m.id === "halfway") {
      if (ctx.goalPackages) {
        const target = Math.ceil(ctx.goalPackages / 2);
        const remaining = target - orderCount;
        if (remaining > 0) {
          return {
            id: m.id,
            label: m.label,
            remaining: formatPackagesLeft(remaining, locale),
          };
        }
      } else if (ctx.goalOre) {
        const remaining = Math.ceil(ctx.goalOre / 2) - totalSalesOre;
        if (remaining > 0) {
          return {
            id: m.id,
            label: m.label,
            remaining: formatAmountLeft(remaining, locale),
          };
        }
      }
      continue;
    }

    if (m.id === "goal_reached") {
      if (ctx.goalPackages) {
        const remaining = ctx.goalPackages - orderCount;
        if (remaining > 0) {
          return {
            id: m.id,
            label: m.label,
            remaining: formatPackagesLeft(remaining, locale),
          };
        }
      } else if (ctx.goalOre) {
        const remaining = ctx.goalOre - totalSalesOre;
        if (remaining > 0) {
          return {
            id: m.id,
            label: m.label,
            remaining: formatAmountLeft(remaining, locale),
          };
        }
      }
      continue;
    }

    if (m.thresholdOre) {
      const remaining = m.thresholdOre - totalSalesOre;
      if (remaining > 0) {
        return {
          id: m.id,
          label: m.label,
          remaining: formatAmountLeft(remaining, locale),
        };
      }
    }
    if (m.thresholdPackages) {
      const remaining = m.thresholdPackages - orderCount;
      if (remaining > 0) {
        return {
          id: m.id,
          label: m.label,
          remaining: formatPackagesLeft(remaining, locale),
        };
      }
    }
  }

  return null;
}
