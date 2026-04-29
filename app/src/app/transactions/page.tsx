import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listCategories } from "@/lib/categories";
import { TransactionList } from "@/components/transaction-list";
import { TransactionFilters } from "@/components/transaction-filters";
import { resolveRange } from "@/lib/date-range";
import { formatTHB } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { TxKind } from "@/lib/types";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { ledgerId } = await requireSession();
  const range = resolveRange(sp.range);

  const kindParam = sp.kind === "income" || sp.kind === "expense" ? (sp.kind as TxKind) : undefined;

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

  const totalIncome = items.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = items.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">รายการทั้งหมด</h1>
          <p className="text-sm text-(--muted) mt-0.5">{range.label}</p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
        >
          <Plus size={18} />
          เพิ่มรายการ
        </Link>
      </div>

      <TransactionFilters categories={categories} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Stat label="รายรับ" value={totalIncome} tone="income" />
        <Stat label="รายจ่าย" value={totalExpense} tone="expense" />
        <Stat
          label="ยอดสุทธิ"
          value={totalIncome - totalExpense}
          tone={totalIncome - totalExpense >= 0 ? "income" : "expense"}
          showSign
        />
      </div>

      <TransactionList items={items} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  showSign,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  showSign?: boolean;
}) {
  const cls = tone === "income" ? "text-(--income)" : "text-(--expense)";
  const sign = showSign ? (value >= 0 ? "+" : "−") : "";
  return (
    <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3">
      <div className="text-xs text-(--muted) mb-0.5">{label}</div>
      <div className={`font-semibold tabular-nums ${cls}`}>
        {sign}
        {formatTHB(Math.abs(value))}
      </div>
    </div>
  );
}
