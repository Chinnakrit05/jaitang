"use client";

import Link from "next/link";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

import { cn, formatCurrency } from "@/lib/utils";
import { GoalProgressBar } from "@/components/goal-progress-bar";
import type { GoalStats } from "@/lib/goals";

/**
 * Card on the /goals list. Click → goal detail. Shows progress bar
 * + numbers + deadline countdown. Achieved goals get a green check
 * accent and "✓ achieved" pill instead of a deadline string.
 */
export function GoalCard({
  goal,
  currency,
  fmtLocale,
}: {
  goal: GoalStats;
  currency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();

  const deadlineLabel = goal.deadline
    ? new Intl.DateTimeFormat(fmtLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(goal.deadline))
    : null;

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 card-hover",
        goal.archived
          ? "border-(--border) bg-(--card)/60 opacity-75"
          : goal.achieved
          ? "border-(--income)/40 bg-(--income)/5"
          : "border-(--border) bg-(--card) hover:border-(--muted)/40"
      )}
    >
      <Link href={`/goals/${goal.id}`} className="block space-y-3">
        <div className="flex items-start gap-3">
          <EmojiOrIcon value={goal.icon} fallback="bullseye" size={32} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{goal.name}</h3>
              {goal.achieved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--income) bg-(--income)/10 border border-(--income)/30 rounded-full px-2 py-0.5">
                  <JtIcon name="check-circle-2" size={16} />
                  {t("goals.achievedBadge")}
                </span>
              )}
              {goal.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  <JtIcon name="archive" size={16} />
                  {t("goals.archivedBadge")}
                </span>
              )}
            </div>
            <div className="text-xs text-(--muted) mt-0.5 tabular-nums">
              {formatCurrency(goal.currentAmount, currency, fmtLocale)}
              <span className="mx-1">/</span>
              {formatCurrency(goal.target_amount, currency, fmtLocale)}
            </div>
          </div>
        </div>

        <GoalProgressBar
          progress={goal.progress}
          color={goal.color}
          size="md"
          showLabel
        />

        <div className="flex items-center justify-between text-[11px] text-(--muted)">
          {deadlineLabel ? (
            <span>{t("goals.deadlineLabel", { date: deadlineLabel })}</span>
          ) : (
            <span>{t("goals.noDeadline")}</span>
          )}
          {!goal.achieved && goal.monthlyRequired !== null && (
            <span className="tabular-nums">
              {t("goals.monthlyHint", {
                amount: formatCurrency(
                  goal.monthlyRequired,
                  currency,
                  fmtLocale
                ),
              })}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
