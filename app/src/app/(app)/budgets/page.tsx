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

  // Budgets are parent-only — the rollup combines a parent's direct spend
  // with every sub's spend so the limit covers the whole branch.
  const expenseCats = categories.filter(
    (c) => c.kind === "expense" && c.parent_id === null,
  );
  const parentByChild = new Map<string, string>();
  for (const c of categories) {
    if (c.parent_id) parentByChild.set(c.id, c.parent_id);
  }
  const budgetByCat = new Map(budgets.map((b) => [b.category_id, b]));
  const spentByCat = new Map<string, number>();
  for (const c of summary.byCategory) {
    if (c.kind !== "expense" || !c.category_id) continue;
    const rollupId = parentByChild.get(c.category_id) ?? c.category_id;
    spentByCat.set(rollupId, (spentByCat.get(rollupId) ?? 0) + c.total);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("budgets.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("budgets.subtitle")}</p>
      </div>

      <ul className="rounded-[22px] soft-raised divide-y divide-(--border) overflow-hidden">
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
