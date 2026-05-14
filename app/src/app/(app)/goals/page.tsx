import { getLocale, getTranslations } from "next-intl/server";
import { JtIcon } from "@/components/icons";
import { requireSession } from "@/lib/session";
import { listGoals } from "@/lib/goals";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { GoalCard } from "@/components/goal-card";
import { CreateGoalForm } from "@/components/create-goal-form";
import { EmptyIllustration } from "@/components/empty-illustration";

export default async function GoalsPage() {
  const [{ ledgerId, ledger }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  const goals = await listGoals(ledgerId, { includeArchived: true });
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  // Quick header stat: total saved across active goals (encouraging).
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <JtIcon name="goals" size={22} className="text-(--accent)" />
          {t("goals.title")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">{t("goals.subtitle")}</p>
      </div>

      {active.length > 0 && (
        <div className="rounded-2xl border border-(--border) bg-(--card) p-4 flex items-center justify-between text-sm">
          <span className="text-(--muted)">{t("goals.totalProgressLabel")}</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(totalSaved, ledger.currency, fmtLocale)}
            <span className="text-(--muted) mx-1">/</span>
            {formatCurrency(totalTarget, ledger.currency, fmtLocale)}
          </span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
          {t("goals.activeSection", { count: active.length })}
        </h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 p-8 text-center">
            <EmptyIllustration kind="goal" size={80} className="mb-3" />
            <p className="text-sm text-(--muted)">{t("goals.activeEmpty")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <JtIcon name="plus-fab" size={16} />
          {t("goals.createTitle")}
        </h2>
        <p className="text-sm text-(--muted)">{t("goals.createHint")}</p>
        <CreateGoalForm ledgerCurrency={ledger.currency} />
      </section>

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide flex items-center gap-2">
            <JtIcon name="archive" size={14} />
            {t("goals.archivedSection", { count: archived.length })}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archived.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
