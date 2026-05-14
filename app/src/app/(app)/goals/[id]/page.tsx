import Link from "next/link";
import { JtIcon } from "@/components/icons";
import { notFound } from "next/navigation";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getGoal, listContributions } from "@/lib/goals";
import { generateGoalNudge } from "@/lib/goals-ai";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GoalProgressBar } from "@/components/goal-progress-bar";
import { ContributeForm } from "@/components/contribute-form";
import { EditGoalModal } from "@/components/edit-goal-modal";
import { GoalActions } from "@/components/goal-actions";
import { DeleteContributionButton } from "@/components/delete-contribution-button";
import {
  archiveGoalAction,
  deleteGoalAction,
  unarchiveGoalAction,
} from "@/app/(app)/goals/actions";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;
  const [{ id }, { ledgerId, ledger, role }, t, locale] = await Promise.all([
    params,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const canManage = role !== "viewer";

  const goal = await getGoal(id, ledgerId);
  if (!goal) notFound();

  const contributions = await listContributions(goal.id, 50);
  const remaining = Math.max(0, goal.target_amount - goal.currentAmount);

  // AI nudge runs in parallel with the rest of the page render. We
  // catch failures here rather than letting them bubble — the page
  // should still load if Anthropic is down.
  let aiNudge: string | null = null;
  if (aiEnabled && !goal.archived) {
    try {
      aiNudge = await generateGoalNudge(goal, locale, ledger.currency);
    } catch {
      aiNudge = null;
    }
  }

  // Bind action ids before passing to client components.
  const archiveBound = archiveGoalAction.bind(null, goal.id);
  const unarchiveBound = unarchiveGoalAction.bind(null, goal.id);
  const deleteBound = deleteGoalAction.bind(null, goal.id);

  const deadlineLabel = goal.deadline
    ? new Intl.DateTimeFormat(fmtLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(goal.deadline))
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <JtIcon name="arrow-left" size={16} />
        {t("goals.backToList")}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-(--border) bg-(--card) p-5 relative">
        {canManage && (
          <div className="absolute top-3 right-3 z-10">
            <EditGoalModal goal={goal} ledgerCurrency={ledger.currency} />
          </div>
        )}
        <div className="flex items-start gap-4">
          <span className="text-5xl shrink-0">{goal.icon ?? "🎯"}</span>
          <div className="flex-1 min-w-0">
            <h1
              className={`text-2xl font-bold flex items-center gap-2 flex-wrap ${
                canManage ? "pr-12 sm:pr-28" : ""
              }`}
            >
              {goal.name}
              {goal.achieved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--income) bg-(--income)/10 border border-(--income)/30 rounded-full px-2 py-0.5">
                  <JtIcon name="check-circle-2" size={12} />
                  {t("goals.achievedBadge")}
                </span>
              )}
              {goal.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  {t("goals.archivedBadge")}
                </span>
              )}
            </h1>
            {deadlineLabel && (
              <p className="text-sm text-(--muted) mt-1 flex items-center gap-1.5">
                <JtIcon name="calendar" size={12} />
                {t("goals.deadlineLabel", { date: deadlineLabel })}
              </p>
            )}
          </div>
        </div>

        {/* Big progress display */}
        <div className="mt-5 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1">
            <div className="text-3xl font-bold tabular-nums">
              {formatCurrency(goal.currentAmount, ledger.currency, fmtLocale)}
            </div>
            <div className="text-sm text-(--muted) tabular-nums">
              / {formatCurrency(goal.target_amount, ledger.currency, fmtLocale)}
              <span className="ml-2 text-(--foreground) font-semibold">
                {Math.round(goal.progress * 100)}%
              </span>
            </div>
          </div>
          <GoalProgressBar
            progress={goal.progress}
            color={goal.color}
            size="lg"
          />
          {!goal.achieved && (
            <div className="flex items-center justify-between text-xs text-(--muted) tabular-nums">
              <span>
                {t("goals.remainingLabel", {
                  amount: formatCurrency(remaining, ledger.currency, fmtLocale),
                })}
              </span>
              {goal.monthlyRequired !== null && goal.monthsRemaining !== null && (
                <span>
                  {t("goals.monthlyHintLong", {
                    amount: formatCurrency(
                      goal.monthlyRequired,
                      ledger.currency,
                      fmtLocale
                    ),
                    months: goal.monthsRemaining,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {canManage && (
          <GoalActions
            goalId={goal.id}
            archived={goal.archived}
            onArchive={archiveBound}
            onUnarchive={unarchiveBound}
            onDelete={deleteBound}
            labels={{
              archive: t("goals.archive"),
              unarchive: t("goals.unarchive"),
              delete: t("goals.delete"),
              archiveConfirm: t("goals.archiveConfirm"),
              deleteConfirm: t("goals.deleteConfirm", { name: goal.name }),
              working: t("common.saving"),
            }}
          />
        )}
      </div>

      {/* AI nudge */}
      {!goal.archived && (
        <section className="rounded-2xl border border-(--accent)/40 bg-(--accent)/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <JtIcon name="sparkles" size={14} className="text-(--accent)" />
            {t("goals.aiHeading")}
          </div>
          {!aiEnabled ? (
            <p className="text-sm text-(--muted)">{t("goals.aiDisabled")}</p>
          ) : aiNudge ? (
            <p className="text-sm leading-relaxed">{aiNudge}</p>
          ) : (
            <p className="text-sm text-(--muted)">{t("goals.aiUnavailable")}</p>
          )}
        </section>
      )}

      {/* Contribute */}
      {canManage && !goal.archived && (
        <ContributeForm goalId={goal.id} currency={ledger.currency} />
      )}

      {/* Contribution history */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          {t("goals.historyHeading")}
          {contributions.length > 0 && (
            <span className="text-xs font-medium text-(--muted)">
              ({contributions.length})
            </span>
          )}
        </h2>
        {contributions.length === 0 ? (
          <p className="text-sm text-(--muted)">{t("goals.historyEmpty")}</p>
        ) : (
          <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
            {contributions.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 group hover:bg-(--background) transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-(--income) font-semibold tabular-nums">
                    +{formatCurrency(c.amount, ledger.currency, fmtLocale)}
                  </div>
                  {c.note && (
                    <div className="text-sm text-(--muted) truncate">
                      {c.note}
                    </div>
                  )}
                  <div className="text-xs text-(--muted)">
                    {formatDate(c.occurred_at, fmtLocale)}
                  </div>
                </div>
                {canManage && !goal.archived && (
                  <DeleteContributionButton
                    contributionId={c.id}
                    confirmLabel={t("goals.contribDeleteConfirm")}
                    aria={t("common.delete")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
