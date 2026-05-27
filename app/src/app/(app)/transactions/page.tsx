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

  // Categories are needed for both the filter pills AND to expand a
  // picked parent into "parent + its subs" before querying. We fetch
  // them first then derive the id list, so a tap on อาหาร surfaces
  // คาเฟ่ / ของหวาน rows too instead of just rows tagged with the
  // bare parent id.
  const categories = await listCategories(ledgerId);
  const picked = sp.category;
  let categoryIds: string[] | undefined;
  if (picked) {
    const selected = categories.find((c) => c.id === picked);
    if (selected && selected.parent_id === null) {
      const subs = categories
        .filter((c) => c.parent_id === selected.id)
        .map((c) => c.id);
      categoryIds = [selected.id, ...subs];
    } else {
      // Sub-category picked, or unknown id (deleted?) — match exact only.
      categoryIds = [picked];
    }
  }
  const items = await listTransactions({
    ledgerId,
    from: range.from,
    to: range.to,
    kind: kindParam,
    categoryIds,
    tripId: tripFilter as string | null | undefined,
    search: searchQ,
    limit: 500,
  });

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
