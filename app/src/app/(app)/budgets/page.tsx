import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listBudgets } from "@/lib/budgets";
import { getMonthSummary } from "@/lib/transactions";
import { BudgetRow } from "@/components/budget-row";
import { getTranslations } from "next-intl/server";

export default async function BudgetsPage() {
  const { ledgerId } = await requireSession();
  const t = await getTranslations();
  const now = new Date();

  const [categories, budgets, summary] = await Promise.all([
    listCategories(ledgerId),
    listBudgets(ledgerId),
    getMonthSummary(ledgerId, now.getFullYear(), now.getMonth() + 1),
  ]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const budgetByCat = new Map(budgets.map((b) => [b.category_id, b]));
  const spentByCat = new Map(
    summary.byCategory
      .filter((c) => c.kind === "expense" && c.category_id)
      .map((c) => [c.category_id as string, c.total])
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("budgets.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("budgets.subtitle")}</p>
      </div>

      <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
        {expenseCats.map((c) => (
          <BudgetRow
            key={c.id}
            category={c}
            budget={budgetByCat.get(c.id)}
            spent={spentByCat.get(c.id) ?? 0}
          />
        ))}
        {expenseCats.length === 0 && (
          <li className="px-4 py-8 text-center text-(--muted) text-sm">
            {t("budgets.empty")}
          </li>
        )}
      </ul>
    </div>
  );
}
