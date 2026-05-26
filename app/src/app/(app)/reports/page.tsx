import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listRecurring } from "@/lib/recurring";
import { nowInBusinessTz } from "@/lib/business-tz";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrencyCompact } from "@/lib/utils";
import {
  updateRecurringAmountAction,
  updateTransactionAmountAction,
} from "./actions";
import { InlineAmount } from "./inline-amount";

/**
 * Monthly review page. Mirrors the Figma "รายงานรายเดือน" mockup:
 *
 *   ┌── month switcher ──┐
 *   ├── summary card  ───┤  income | expense | balance
 *   ├── view toggle ─────┤  "Style 1" / "Style 2 (table)"
 *   ├── INCOME section ──┤  green header
 *   │   · recurring rules (income kind) first
 *   │   · then regular income transactions
 *   ├── EXPENSE section ─┤  red header
 *   │   · recurring rules (expense kind) first
 *   │   · then regular expense transactions
 *   └────────────────────┘
 *
 * Every amount cell is inline-editable — wired to single-field server
 * actions that update the underlying transaction or recurring rule.
 */
export default async function ReportsPage({
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

  const now = nowInBusinessTz();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ymRaw = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : fallback;
  const [yStr, mStr] = ymRaw.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const view = sp.view === "list" ? "list" : "table";

  // Compute UTC bounds for the calendar month. We don't try to be clever
  // about the user's TZ here — sumPeriod / listTransactions all use UTC
  // bounds and the business TZ helper above is just for picking "now".
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 1)).toISOString();

  const [txs, recurring] = await Promise.all([
    listTransactions({ ledgerId, from, to }),
    listRecurring(ledgerId),
  ]);
  const activeRecurring = recurring.filter((r) => r.active);

  const incomeTxs = txs.filter((tx) => tx.kind === "income");
  const expenseTxs = txs.filter((tx) => tx.kind === "expense");
  const incomeRules = activeRecurring.filter((r) => r.kind === "income");
  const expenseRules = activeRecurring.filter((r) => r.kind === "expense");

  const totalIncome = incomeTxs.reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = expenseTxs.reduce((s, tx) => s + tx.amount, 0);
  const balance = totalIncome - totalExpense;

  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const currency = ledger.currency;

  return (
    <div className="max-w-md mx-auto pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/more"
          aria-label={t("common.back")}
          className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-left" size={18} />
        </Link>
        <h1 className="text-base font-semibold">{t("reports.title")}</h1>
        <span className="w-10" aria-hidden />
      </div>

      {/* Month switcher */}
      <div className="rounded-2xl border border-(--border) bg-(--card) flex items-center justify-between px-3 py-2">
        <Link
          href={`/reports?ym=${prev}&view=${view}`}
          aria-label={t("calendar.prev")}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-left" size={20} />
        </Link>
        <span className="font-semibold tabular-nums">{monthLabel}</span>
        <Link
          href={`/reports?ym=${next}&view=${view}`}
          aria-label={t("calendar.next")}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-right" size={20} />
        </Link>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-(--border) bg-(--card) grid grid-cols-3 divide-x divide-(--border)/60">
        <SumCell
          label={t("transactions.totalIncome")}
          amount={totalIncome}
          color="income"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <SumCell
          label={t("transactions.totalExpense")}
          amount={-totalExpense}
          color="expense"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <SumCell
          label={t("reports.balance")}
          amount={balance}
          color={balance >= 0 ? "foreground" : "expense"}
          currency={currency}
          fmtLocale={fmtLocale}
        />
      </div>

      {/* View toggle */}
      <div className="rounded-full border border-(--border) bg-(--card) p-1 grid grid-cols-2">
        <Link
          href={`/reports?ym=${ymRaw}&view=list`}
          className={`py-2 text-center text-sm font-semibold rounded-full transition ${
            view === "list" ? "shadow-sm" : "text-(--muted)"
          }`}
          style={
            view === "list"
              ? { background: "#E89A6A", color: "white" }
              : undefined
          }
        >
          {t("reports.styleA")}
        </Link>
        <Link
          href={`/reports?ym=${ymRaw}&view=table`}
          className={`py-2 text-center text-sm font-semibold rounded-full transition ${
            view === "table" ? "shadow-sm" : "text-(--muted)"
          }`}
          style={
            view === "table"
              ? { background: "#E89A6A", color: "white" }
              : undefined
          }
        >
          {t("reports.styleB")}
        </Link>
      </div>

      {/* Income section */}
      <ReportSection
        kind="income"
        title={t("transactions.totalIncome")}
        rules={incomeRules}
        txs={incomeTxs}
        total={totalIncome}
        currency={currency}
        emptyLabel={t("reports.empty")}
        totalLabel={t("reports.totalIncome")}
      />

      {/* Expense section */}
      <ReportSection
        kind="expense"
        title={t("transactions.totalExpense")}
        rules={expenseRules}
        txs={expenseTxs}
        total={totalExpense}
        currency={currency}
        emptyLabel={t("reports.empty")}
        totalLabel={t("reports.totalExpense")}
      />
    </div>
  );
}

function SumCell({
  label,
  amount,
  color,
  currency,
  fmtLocale,
}: {
  label: string;
  amount: number;
  color: "income" | "expense" | "foreground";
  currency: string;
  fmtLocale: string;
}) {
  const textCls =
    color === "income"
      ? "text-(--income)"
      : color === "expense"
      ? "text-(--expense)"
      : "text-(--foreground)";
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[11px] text-(--muted) mb-0.5">{label}</p>
      <p className={`font-bold tabular-nums text-sm ${textCls}`}>
        {sign}
        {formatCurrencyCompact(Math.abs(amount), currency, fmtLocale)}
      </p>
    </div>
  );
}

type Rule = Awaited<ReturnType<typeof listRecurring>>[number];
type Tx = Awaited<ReturnType<typeof listTransactions>>[number];

function ReportSection({
  kind,
  title,
  rules,
  txs,
  total,
  currency,
  emptyLabel,
  totalLabel,
}: {
  kind: "income" | "expense";
  title: string;
  rules: Rule[];
  txs: Tx[];
  total: number;
  currency: string;
  emptyLabel: string;
  totalLabel: string;
}) {
  const headerColor = kind === "income" ? "#16A34A" : "#DC2626";
  const isEmpty = rules.length === 0 && txs.length === 0;

  return (
    <section className="rounded-2xl border border-(--border) overflow-hidden bg-(--card)">
      <header
        className="px-4 py-2 text-white font-semibold text-sm"
        style={{ background: headerColor }}
      >
        {title}
      </header>

      {isEmpty ? (
        <p className="px-4 py-4 text-sm text-(--muted)">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-(--border)/60">
          {/* Recurring rules first — surfaces the "expected" line items
              at the top of each section so the user can scrub through
              them without diving into /recurring. */}
          {rules.map((r) => (
            <RuleRow key={`r-${r.id}`} rule={r} currency={currency} />
          ))}
          {txs.map((tx) => (
            <TxRow key={tx.id} tx={tx} currency={currency} />
          ))}
        </ul>
      )}

      {!isEmpty && (
        <div
          className="px-4 py-2 flex items-center justify-between border-t border-(--border)/60"
          style={{
            background: `color-mix(in srgb, ${headerColor} 8%, var(--card))`,
          }}
        >
          <span className="text-sm font-medium">{totalLabel}</span>
          <span className="font-bold tabular-nums">
            {currency === "THB" ? "฿" : currency}
            {Math.round(total).toLocaleString()}
          </span>
        </div>
      )}
    </section>
  );
}

function TxRow({ tx, currency }: { tx: Tx; currency: string }) {
  const note = tx.note?.trim();
  const catName = tx.category?.name ?? "";
  const primary = note || catName || "—";
  const sub = note && catName ? catName : "";

  // Bind the txId into the action so the client component just sees a
  // single-arg (amount) function. Server-side closure makes the txId
  // unforgeable from the client.
  async function action(amount: number) {
    "use server";
    return updateTransactionAmountAction(tx.id, amount);
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{primary}</p>
        {sub && <p className="text-xs text-(--muted) truncate">{sub}</p>}
      </div>
      <InlineAmount
        initial={tx.amount}
        currency={currency}
        action={action}
      />
    </li>
  );
}

function RuleRow({ rule, currency }: { rule: Rule; currency: string }) {
  const note = rule.note?.trim();
  const catName = rule.category?.name ?? "";
  const primary = note || catName || "—";
  const sub = note && catName ? catName : "";

  async function action(amount: number) {
    "use server";
    return updateRecurringAmountAction(rule.id, amount);
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "color-mix(in srgb, #F9D5B4 50%, var(--card))",
        }}
        title="recurring"
        aria-label="recurring"
      >
        <EmojiOrIcon value={rule.category?.icon} fallback="recurring" size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{primary}</p>
        <p className="text-xs text-(--muted) truncate">
          {sub || rule.period}
        </p>
      </div>
      <InlineAmount
        initial={rule.amount ?? 0}
        currency={currency}
        action={action}
      />
    </li>
  );
}
