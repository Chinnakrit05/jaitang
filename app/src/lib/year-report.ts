import { listTransactions } from "@/lib/transactions";
import { businessTzMidnightUtc } from "@/lib/business-tz";
import type { TransactionWithCategory } from "@/lib/types";

export type MonthBucket = {
  /** YYYY-MM, in business timezone. */
  monthKey: string;
  income: number;
  expense: number;
};

export type CategoryBucket = {
  category_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
};

export type BiggestTx = {
  id: string;
  occurred_at: string;
  amount: number;
  note: string | null;
  category: { name: string; icon: string | null } | null;
};

export type YearReport = {
  year: number;
  /** Total of `kind: 'income'` rows in home currency for the year. */
  totalIncome: number;
  /** Total of `kind: 'expense'` rows in home currency for the year. */
  totalExpense: number;
  net: number;
  txCount: number;
  /** 12 buckets (Jan..Dec), in order, with zeros where there were no rows. */
  monthly: MonthBucket[];
  topExpenseCategories: CategoryBucket[];
  topIncomeCategories: CategoryBucket[];
  biggestExpense: BiggestTx | null;
  biggestIncome: BiggestTx | null;
  /** YoY compare: same shape for the prior calendar year, or null if
   *  there are no transactions then (first-year users). */
  priorYear: {
    totalIncome: number;
    totalExpense: number;
  } | null;
  /** YYYY-MM of the heaviest spending month. null when the whole year
   *  had no expenses. */
  peakMonth: string | null;
  /** True when the user has no transactions at all in this year. */
  empty: boolean;
};

/**
 * Aggregate a calendar year into `YearReport`. Year boundaries use
 * BUSINESS_TZ so a Bangkok user's "2026" runs Jan 1 00:00 +07 → Jan 1
 * 00:00 +07 next year — no UTC drift.
 */
export async function buildYearReport(
  ledgerId: string,
  year: number
): Promise<YearReport> {
  const from = businessTzMidnightUtc(year, 0, 1).toISOString();
  const to = businessTzMidnightUtc(year + 1, 0, 1).toISOString();
  const priorFrom = businessTzMidnightUtc(year - 1, 0, 1).toISOString();
  const priorTo = from;

  const [items, priorItems] = await Promise.all([
    listTransactions({ ledgerId, from, to, limit: 50000 }),
    listTransactions({
      ledgerId,
      from: priorFrom,
      to: priorTo,
      limit: 50000,
    }),
  ]);

  const monthly: MonthBucket[] = Array.from({ length: 12 }, (_, i) => ({
    monthKey: `${year}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
  }));

  const expenseByCat = new Map<string, CategoryBucket>();
  const incomeByCat = new Map<string, CategoryBucket>();
  let totalIncome = 0;
  let totalExpense = 0;
  let biggestExpense: BiggestTx | null = null;
  let biggestIncome: BiggestTx | null = null;

  for (const tx of items) {
    const monthIndex = monthIndexInBusinessTz(tx.occurred_at);
    if (monthIndex < 0 || monthIndex > 11) continue;
    const bucket = monthly[monthIndex];
    if (tx.kind === "income") {
      bucket.income += tx.amount;
      totalIncome += tx.amount;
      addToCategoryBucket(incomeByCat, tx);
      if (!biggestIncome || tx.amount > biggestIncome.amount) {
        biggestIncome = txToBiggest(tx);
      }
    } else {
      bucket.expense += tx.amount;
      totalExpense += tx.amount;
      addToCategoryBucket(expenseByCat, tx);
      if (!biggestExpense || tx.amount > biggestExpense.amount) {
        biggestExpense = txToBiggest(tx);
      }
    }
  }

  const topExpenseCategories = Array.from(expenseByCat.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const topIncomeCategories = Array.from(incomeByCat.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  let priorIncome = 0;
  let priorExpense = 0;
  for (const tx of priorItems) {
    if (tx.kind === "income") priorIncome += tx.amount;
    else priorExpense += tx.amount;
  }
  const priorYear =
    priorItems.length > 0
      ? { totalIncome: priorIncome, totalExpense: priorExpense }
      : null;

  // Peak month: highest expense bucket; null when zero spending all year.
  let peakMonth: string | null = null;
  let peakExpense = 0;
  for (const m of monthly) {
    if (m.expense > peakExpense) {
      peakExpense = m.expense;
      peakMonth = m.monthKey;
    }
  }

  return {
    year,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    txCount: items.length,
    monthly,
    topExpenseCategories,
    topIncomeCategories,
    biggestExpense,
    biggestIncome,
    priorYear,
    peakMonth,
    empty: items.length === 0,
  };
}

/**
 * Compute the calendar month (0..11) in BUSINESS_TZ for an ISO string.
 * Same idea as dayKeyInTz but month-precision.
 */
function monthIndexInBusinessTz(iso: string): number {
  // Reuse the same shift trick: add the offset, then read UTC parts.
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 7 * 3600_000);
  return shifted.getUTCMonth();
}

function addToCategoryBucket(
  map: Map<string, CategoryBucket>,
  tx: TransactionWithCategory
) {
  const key = tx.category?.id ?? "__null__";
  const existing = map.get(key);
  if (existing) {
    existing.total += tx.amount;
    return;
  }
  map.set(key, {
    category_id: tx.category?.id ?? null,
    name: tx.category?.name ?? "",
    icon: tx.category?.icon ?? null,
    color: tx.category?.color ?? null,
    total: tx.amount,
  });
}

function txToBiggest(tx: TransactionWithCategory): BiggestTx {
  return {
    id: tx.id,
    occurred_at: tx.occurred_at,
    amount: tx.amount,
    note: tx.note,
    category: tx.category
      ? { name: tx.category.name, icon: tx.category.icon }
      : null,
  };
}
