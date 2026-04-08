import type { SellerGrade, SellerGradeId } from "@/types/fundraising";

const GRADE_CONFIG: Record<
  SellerGradeId,
  { icon: string; color: string; bg: string; border: string }
> = {
  starter: {
    icon: "🌱",
    color: "text-brand-500",
    bg: "bg-brand-50",
    border: "border-brand-200",
  },
  bronze: {
    icon: "🥉",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  silver: {
    icon: "🥈",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
  gold: {
    icon: "🥇",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  diamond: {
    icon: "💎",
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
  },
};

export function getGradeConfig(grade: SellerGradeId) {
  return GRADE_CONFIG[grade] ?? GRADE_CONFIG.starter;
}

export function GradeBadge({
  grade,
  size = "sm",
}: {
  grade: SellerGrade | undefined;
  size?: "sm" | "lg";
}) {
  if (!grade) return null;
  const cfg = getGradeConfig(grade.grade);

  if (size === "lg") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${cfg.bg} ${cfg.border}`}
      >
        <span className="text-2xl">{cfg.icon}</span>
        <span className={`text-base font-semibold ${cfg.color}`}>
          {grade.label}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span>{cfg.icon}</span>
      {grade.label}
    </span>
  );
}

export function GradeProgress({
  grade,
  className = "",
}: {
  grade: SellerGrade | undefined;
  className?: string;
}) {
  if (!grade?.nextGrade) return null;

  const currentThreshold = grade.thresholdOre;
  const nextThreshold = currentThreshold + grade.nextGrade.remainingOre;
  const totalRange = nextThreshold - currentThreshold;
  const progress = totalRange > 0
    ? Math.min(100, Math.round(((totalRange - grade.nextGrade.remainingOre) / totalRange) * 100))
    : 100;

  const nextCfg = getGradeConfig(grade.nextGrade.grade);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          Nästa: {grade.nextGrade.label} {nextCfg.icon}
        </span>
        <span className="text-xs text-muted-foreground">
          {(grade.nextGrade.remainingOre / 100).toLocaleString("sv-SE")} kr kvar
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
