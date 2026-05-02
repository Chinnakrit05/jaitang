import { getMonthSummary } from "@/lib/transactions";
import type { MonthSummary } from "@/lib/types";

export type CategoryDelta = {
  /** stable id from this month's row, or `prev:<id>` if only present last month */
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  thisAmount: number;
  prevAmount: number;
  delta: number; // thisAmount - prevAmount, positive = up
  deltaPct: number | null; // null when prev was 0 (avoid Infinity)
};

export type MonthCompare = {
  this: MonthSummary;
  prev: MonthSummary;
  /** Convenience deltas at the totals level */
  totals: {
    incomeDelta: number;
    incomeDeltaPct: number | null;
    expenseDelta: number;
    expenseDeltaPct: number | null;
  };
  /** Top 3 categories by absolute change in EXPENSE (most relevant for users). */
  expenseUp: CategoryDelta[];
  expenseDown: CategoryDelta[];
};

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * Compare a ledger's `(year, month)` to its previous calendar month (in
 * BUSINESS_TZ — `getMonthSummary` already handles that). Returns totals
 * deltas plus a category-level mover list useful for the dashboard
 * insights card.
 */
export async function compareMonths(
  ledgerId: string,
  year: number,
  month: number // 1-12
): Promise<MonthCompare> {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [thisM, prevM] = await Promise.all([
    getMonthSummary(ledgerId, year, month),
    getMonthSummary(ledgerId, prevYear, prevMonth),
  ]);

  const totals = {
    incomeDelta: thisM.income - prevM.income,
    incomeDeltaPct: pct(thisM.income, prevM.income),
    expenseDelta: thisM.expense - prevM.expense,
    expenseDeltaPct: pct(thisM.expense, prevM.expense),
  };

  // Build a category-keyed map from each month, then unify. Categories
  // are keyed by `kind:category_id` (matching what `aggregateMonthSummary`
  // does). We only care about expense rows for the mover list — income
  // categories are too volatile (one-off bonuses dominate the chart).
  type Cat = MonthSummary["byCategory"][number];
  const indexByKey = (sum: MonthSummary) => {
    const m = new Map<string, Cat>();
    for (const c of sum.byCategory) {
      if (c.kind !== "expense") continue;
      const key = `expense:${c.category_id ?? "none"}`;
      m.set(key, c);
    }
    return m;
  };
  const thisMap = indexByKey(thisM);
  const prevMap = indexByKey(prevM);
  const allKeys = new Set([...thisMap.keys(), ...prevMap.keys()]);

  const deltas: CategoryDelta[] = [];
  for (const key of allKeys) {
    const a = thisMap.get(key);
    const b = prevMap.get(key);
    const ref = a ?? b!;
    const thisAmount = a?.total ?? 0;
    const prevAmount = b?.total ?? 0;
    const delta = thisAmount - prevAmount;
    if (delta === 0) continue; // skip steady-state rows
    deltas.push({
      id: key,
      name: ref.name,
      icon: ref.icon,
      color: ref.color,
      thisAmount,
      prevAmount,
      delta,
      deltaPct: pct(thisAmount, prevAmount),
    });
  }

  const expenseUp = deltas
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const expenseDown = deltas
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta) // most negative first
    .slice(0, 3);

  return { this: thisM, prev: prevM, totals, expenseUp, expenseDown };
}
