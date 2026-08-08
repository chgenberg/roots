"use client";

import type { SellerGrade, SellerGradeId } from "@/types/fundraising";
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

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
    color: "text-brand-600",
    bg: "bg-brand-50",
    border: "border-brand-200",
  },
  silver: {
    icon: "🥈",
    color: "text-brand-400",
    bg: "bg-brand-50",
    border: "border-brand-200",
  },
  gold: {
    icon: "🥇",
    color: "text-brand-700",
    bg: "bg-brand-100",
    border: "border-brand-300",
  },
  diamond: {
    icon: "💎",
    color: "text-brand-800",
    bg: "bg-brand-100",
    border: "border-brand-300",
  },
};

export function getGradeConfig(grade: SellerGradeId) {
  return GRADE_CONFIG[grade] ?? GRADE_CONFIG.starter;
}

function gradeLabel(
  gradeId: SellerGradeId,
  locale: "sv" | "en",
  fallback: string
): string {
  const labels = fundraisingPages.sellerGrade[locale];
  return labels[gradeId] ?? fallback;
}

export function GradeBadge({
  grade,
  size = "sm",
}: {
  grade: SellerGrade | undefined;
  size?: "sm" | "lg";
}) {
  const { locale } = useLocale();
  if (!grade) return null;
  const cfg = getGradeConfig(grade.grade);
  const label = gradeLabel(grade.grade, locale, grade.label);

  if (size === "lg") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${cfg.bg} ${cfg.border}`}
      >
        <span className="text-2xl">{cfg.icon}</span>
        <span className={`text-base font-semibold ${cfg.color}`}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span>{cfg.icon}</span>
      {label}
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
  const { locale } = useLocale();
  const t = fundraisingPages.sellerGrade[locale];

  if (!grade?.nextGrade) return null;

  const currentThreshold = grade.thresholdOre;
  const nextThreshold = currentThreshold + grade.nextGrade.remainingOre;
  const totalRange = nextThreshold - currentThreshold;
  const progress =
    totalRange > 0
      ? Math.min(
          100,
          Math.round(
            ((totalRange - grade.nextGrade.remainingOre) / totalRange) * 100
          )
        )
      : 100;

  const nextCfg = getGradeConfig(grade.nextGrade.grade);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {tFill(t.next, {
            label: gradeLabel(
              grade.nextGrade.grade,
              locale,
              grade.nextGrade.label
            ),
          })}{" "}
          {nextCfg.icon}
        </span>
        <span className="text-xs text-muted-foreground">
          {tFill(t.remaining, {
            amount: formatKr(grade.nextGrade.remainingOre, locale),
          })}
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
