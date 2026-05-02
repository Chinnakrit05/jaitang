import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listCategories } from "@/lib/categories";
import { TransactionList } from "@/components/transaction-list";
import { TransactionFilters } from "@/components/transaction-filters";
import { resolveRange } from "@/lib/date-range";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
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

  const [items, categories] = await Promise.all([
    listTransactions({
      ledgerId,
      from: range.from,
      to: range.to,
      kind: kindParam,
      categoryId: sp.category || undefined,
      limit: 500,
    }),
    listCategories(ledgerId),
  ]);

  const totalIncome = items
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = items
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const exportParams = new URLSearchParams();
  if (sp.range) exportParams.set("range", sp.range);
  if (kindParam) exportParams.set("kind", kindParam);
  if (sp.category) exportParams.set("category", sp.category);
  const exportHref = `/transactions/export${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("transactions.title")}</h1>
          <p className="text-sm text-(--muted) mt-0.5">
            {t(`transactions.rangeLabels.${range.key}`)}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 font-medium text-sm transition"
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t("transactions.csv")}</span>
          </a>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
          >
            <Plus size={18} />
            {t("transactions.addNew")}
          </Link>
        </div>
      </div>

      <TransactionFilters categories={categories} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Stat
          label={t("transactions.totalIncome")}
          value={totalIncome}
          tone="income"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <Stat
          label={t("transactions.totalExpense")}
          value={totalExpense}
          tone="expense"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <Stat
          label={t("transactions.net")}
          value={totalIncome - totalExpense}
          tone={totalIncome - totalExpense >= 0 ? "income" : "expense"}
          showSign
          currency={currency}
          fmtLocale={fmtLocale}
        />
      </div>

      <TransactionList items={items} showAttribution={isShared} currency={currency} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  showSign,
  currency,
  fmtLocale,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  showSign?: boolean;
  currency: string;
  fmtLocale: string;
}) {
  const cls = tone === "income" ? "text-(--income)" : "text-(--expense)";
  const sign = showSign ? (value >= 0 ? "+" : "−") : "";
  return (
    <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3 transition hover:border-(--muted)/40">
      <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium mb-1">
        {label}
      </div>
      <div className={`text-base sm:text-lg font-semibold tabular-nums ${cls}`}>
        {sign}
        {formatCurrency(Math.abs(value), currency, fmtLocale)}
      </div>
    </div>
  );
}
