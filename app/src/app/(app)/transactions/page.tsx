import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listCategories } from "@/lib/categories";
import { TransactionList } from "@/components/transaction-list";
import { TransactionsHeader } from "@/components/transactions-header";
import { TransactionsHero } from "@/components/transactions-hero";
import { CategoryFilterPills } from "@/components/category-filter-pills";
import { resolveRange } from "@/lib/date-range";
import { intlLocale } from "@/lib/locale-format";
import { getLocale, getTranslations } from "next-intl/server";

import type { TxKind } from "@/lib/types";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, { ledgerId, ledger }, t, locale] = await Promise.all([
    searchParams,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const range = resolveRange(sp.range);
  const isShared = !ledger.is_personal;
  const currency = ledger.currency;

  const kindParam =
    sp.kind === "income" || sp.kind === "expense" ? (sp.kind as TxKind) : undefined;

  const tripParam = sp.trip;
  const tripFilter =
    tripParam === "none" ? null : tripParam || undefined;

  const searchQ = sp.q?.trim() || undefined;

  const [items, categories] = await Promise.all([
    listTransactions({
      ledgerId,
      from: range.from,
      to: range.to,
      kind: kindParam,
      categoryId: sp.category || undefined,
      tripId: tripFilter as string | null | undefined,
      search: searchQ,
      limit: 500,
    }),
    listCategories(ledgerId),
  ]);

  const totalIncome = items
    .filter((tx) => tx.kind === "income")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = items
    .filter((tx) => tx.kind === "expense")
    .reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-4">
      <TransactionsHeader title={t("transactions.title")} />

      <TransactionsHero
        count={items.length}
        income={totalIncome}
        expense={totalExpense}
        currency={currency}
        fmtLocale={fmtLocale}
      />

      <CategoryFilterPills categories={categories} />

      <TransactionList
        items={items}
        showAttribution={isShared}
        currency={currency}
        highlight={searchQ}
      />
    </div>
  );
}
