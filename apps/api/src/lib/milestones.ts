interface Milestone {
  id: string;
  label: string;
  description: string;
  thresholdOre?: number;
  thresholdPackages?: number;
}

export const MILESTONES: Milestone[] = [
  {
    id: "first_sale",
    label: "Första försäljningen!",
    description: "Du har gjort din första försäljning. Bra start!",
    thresholdOre: 1,
  },
  {
    id: "5_packages",
    label: "5 paket sålda",
    description: "Fantastiskt! Du har sålt 5 paket.",
    thresholdPackages: 5,
  },
  {
    id: "10_packages",
    label: "10 paket sålda",
    description: "Dubbla siffror! 10 paket sålda.",
    thresholdPackages: 10,
  },
  {
    id: "5000_sek",
    label: "5 000 kr",
    description: "Ni har passerat 5 000 kr i försäljning!",
    thresholdOre: 500000,
  },
  {
    id: "halfway",
    label: "Halvvägs!",
    description: "Ni är halvvägs till målet. Fortsätt!",
  },
  {
    id: "25_packages",
    label: "25 paket sålda",
    description: "Imponerande! 25 paket sålda.",
    thresholdPackages: 25,
  },
  {
    id: "10000_sek",
    label: "10 000 kr",
    description: "Fantastiskt! Över 10 000 kr!",
    thresholdOre: 1000000,
  },
  {
    id: "50_packages",
    label: "50 paket sålda",
    description: "50 paket! Ni är en riktig säljmaskin!",
    thresholdPackages: 50,
  },
  {
    id: "goal_reached",
    label: "Mål uppnått!",
    description: "Grattis! Ni har nått ert försäljningsmål!",
  },
];

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
  goalPackages?: number
): Milestone[] {
  const achieved: Milestone[] = [];
  const ctx: MilestoneGoalContext = { goalOre, goalPackages };

  const specialIds = new Set(["first_sale", "halfway", "goal_reached"]);

  for (const m of MILESTONES) {
    if (m.id === "first_sale" && orderCount >= 1) {
      achieved.push(m);
    } else if (m.id === "halfway" && isHalfwayAchieved(totalSalesOre, orderCount, ctx)) {
      achieved.push(m);
    } else if (m.id === "goal_reached" && isGoalReached(totalSalesOre, orderCount, ctx)) {
      achieved.push(m);
    } else if (!specialIds.has(m.id) && m.thresholdOre && totalSalesOre >= m.thresholdOre) {
      achieved.push(m);
    } else if (!specialIds.has(m.id) && m.thresholdPackages && orderCount >= m.thresholdPackages) {
      achieved.push(m);
    }
  }

  return achieved;
}

export function getNextMilestone(
  totalSalesOre: number,
  orderCount: number,
  goalOre?: number,
  goalPackages?: number
): { label: string; remaining: string } | null {
  const achieved = getAchievedMilestones(totalSalesOre, orderCount, goalOre, goalPackages);
  const achievedIds = new Set(achieved.map((m) => m.id));
  const ctx: MilestoneGoalContext = { goalOre, goalPackages };

  for (const m of MILESTONES) {
    if (achievedIds.has(m.id)) continue;

    if (m.id === "halfway") {
      if (ctx.goalPackages) {
        const target = Math.ceil(ctx.goalPackages / 2);
        const remaining = target - orderCount;
        if (remaining > 0) {
          return { label: m.label, remaining: `${remaining} paket kvar` };
        }
      } else if (ctx.goalOre) {
        const remaining = Math.ceil(ctx.goalOre / 2) - totalSalesOre;
        if (remaining > 0) {
          return { label: m.label, remaining: `${(remaining / 100).toLocaleString("sv-SE")} kr kvar` };
        }
      }
      continue;
    }

    if (m.id === "goal_reached") {
      if (ctx.goalPackages) {
        const remaining = ctx.goalPackages - orderCount;
        if (remaining > 0) {
          return { label: m.label, remaining: `${remaining} paket kvar` };
        }
      } else if (ctx.goalOre) {
        const remaining = ctx.goalOre - totalSalesOre;
        if (remaining > 0) {
          return { label: m.label, remaining: `${(remaining / 100).toLocaleString("sv-SE")} kr kvar` };
        }
      }
      continue;
    }

    if (m.thresholdOre) {
      const remaining = m.thresholdOre - totalSalesOre;
      if (remaining > 0) {
        return {
          label: m.label,
          remaining: `${(remaining / 100).toLocaleString("sv-SE")} kr kvar`,
        };
      }
    }
    if (m.thresholdPackages) {
      const remaining = m.thresholdPackages - orderCount;
      if (remaining > 0) {
        return {
          label: m.label,
          remaining: `${remaining} paket kvar`,
        };
      }
    }
  }

  return null;
}
