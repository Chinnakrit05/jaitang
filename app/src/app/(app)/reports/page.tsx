import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listRecurring, isAppliedThisPeriod } from "@/lib/recurring";
import { nowInBusinessTz } from "@/lib/business-tz";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrencyCompact } from "@/lib/utils";
import {
  updateRecurringAmountAction,
  updateRecurringNoteAction,
  updateTransactionAmountAction,
  updateTransactionNoteAction,
} from "./actions";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import {
  deleteRecurringAction,
  fillPendingRecurringAmountAction,
  updateRecurringFillAmountAction,
} from "@/app/(app)/recurring/actions";
import { InlineAmount } from "./inline-amount";
import { InlineNote } from "./inline-note";
import { DeleteRowButton } from "./row-actions";

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

  // Compute UTC bounds for the calendar month. We don't try to be clever
  // about the user's TZ here — sumPeriod / listTransactions all use UTC
  // bounds and the business TZ helper above is just for picking "now".
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 1)).toISOString();

  const [allTxs, recurring] = await Promise.all([
    listTransactions({ ledgerId, from, to }),
    listRecurring(ledgerId),
  ]);
  const activeRecurring = recurring.filter((r) => r.active);

  // Drop transactions that were materialised from a recurring rule
  // from the list rendering — `fillPendingRecurring` /
  // `applyDueRecurring` tag those with a "[ค่าประจำ]" note prefix.
  // They surface above as their parent rule row (with the cached
  // last_fill_amount), so showing them again as a "regular" tx below
  // would double-count visually and the "[ค่าประจำ]" prefix in the
  // note was confusing.
  const isRecurringTx = (tx: (typeof allTxs)[number]) =>
    (tx.note ?? "").trimStart().startsWith("[ค่าประจำ]");
  const listTxs = allTxs.filter((tx) => !isRecurringTx(tx));

  const incomeTxs = listTxs.filter((tx) => tx.kind === "income");
  const expenseTxs = listTxs.filter((tx) => tx.kind === "expense");
  const incomeRules = activeRecurring.filter((r) => r.kind === "income");
  const expenseRules = activeRecurring.filter((r) => r.kind === "expense");

  // What month bucket is the user viewing relative to today? Drives
  // the rule-row amount logic — future months should reset to 0 since
  // no fill has happened yet (the user explicitly asked for this).
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const viewedIsFuture =
    year > currentYear || (year === currentYear && month > currentMonth);
  const viewedIsCurrent = year === currentYear && month === currentMonth;

  // Section totals match what's visible. For each rule, prefer the
  // amount of a matching '[ค่าประจำ]' tx inside the viewed window
  // (that's the real materialised value). Fall back to rule.amount
  // for fixed rules only when the viewed bucket is the current
  // month — past months without a tx mean the rule wasn't run yet,
  // and future months haven't happened. Otherwise show 0.
  function findRuleTx(r: (typeof activeRecurring)[number]) {
    return allTxs.find(
      (tx) =>
        isRecurringTx(tx) &&
        tx.kind === r.kind &&
        tx.category_id === r.category_id
    );
  }
  function ruleRowAmount(r: (typeof activeRecurring)[number]) {
    if (viewedIsFuture) return 0;
    const matched = findRuleTx(r);
    if (matched) return matched.amount;
    if (viewedIsCurrent && r.amount !== null) return r.amount;
    if (viewedIsCurrent) {
      // Variable bill, not yet filled this period — fall through to 0
      // for total math (the row component will show a dashed input
      // via the matching null check in RuleRow).
      return isAppliedThisPeriod(r.last_run_at, r.period) &&
        r.last_fill_amount !== null
        ? r.last_fill_amount
        : 0;
    }
    // Past month with no materialised tx — rule didn't run.
    return 0;
  }
  const sumRules = (rs: typeof activeRecurring) =>
    rs.reduce((s, r) => s + ruleRowAmount(r), 0);
  const sumTxs = (ts: typeof listTxs) => ts.reduce((s, t) => s + t.amount, 0);
  const totalIncome = sumRules(incomeRules) + sumTxs(incomeTxs);
  const totalExpense = sumRules(expenseRules) + sumTxs(expenseTxs);
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
          href={`/reports?ym=${prev}`}
          aria-label={t("calendar.prev")}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-left" size={20} />
        </Link>
        <span className="font-semibold tabular-nums">{monthLabel}</span>
        <Link
          href={`/reports?ym=${next}`}
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
        viewedIsCurrent={viewedIsCurrent}
        viewedIsFuture={viewedIsFuture}
        ruleAmountFor={ruleRowAmount}
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
        viewedIsCurrent={viewedIsCurrent}
        viewedIsFuture={viewedIsFuture}
        ruleAmountFor={ruleRowAmount}
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
  viewedIsCurrent,
  viewedIsFuture,
  ruleAmountFor,
}: {
  kind: "income" | "expense";
  title: string;
  rules: Rule[];
  txs: Tx[];
  total: number;
  currency: string;
  emptyLabel: string;
  totalLabel: string;
  viewedIsCurrent: boolean;
  viewedIsFuture: boolean;
  ruleAmountFor: (r: Rule) => number;
}) {
  const headerColor = kind === "income" ? "#16A34A" : "#DC2626";
  const isEmpty = rules.length === 0 && txs.length === 0;

  return (
    <section className="rounded-2xl border border-(--border) overflow-hidden bg-(--card)">
      <header
        className="px-3 py-1.5 text-white font-semibold text-xs"
        style={{ background: headerColor }}
      >
        {title}
      </header>

      {isEmpty ? (
        <p className="px-3 py-2 text-xs text-(--muted)">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-(--border)/60">
          {/* Recurring rules first — surfaces the "expected" line items
              at the top of each section so the user can scrub through
              them without diving into /recurring. */}
          {rules.map((r) => (
            <RuleRow
              key={`r-${r.id}`}
              rule={r}
              currency={currency}
              displayAmount={ruleAmountFor(r)}
              viewedIsCurrent={viewedIsCurrent}
              viewedIsFuture={viewedIsFuture}
            />
          ))}
          {txs.map((tx) => (
            <TxRow key={tx.id} tx={tx} currency={currency} />
          ))}
        </ul>
      )}

      {!isEmpty && (
        <div
          className="px-3 py-1.5 flex items-center justify-between border-t border-(--border)/60"
          style={{
            background: `color-mix(in srgb, ${headerColor} 8%, var(--card))`,
          }}
        >
          <span className="text-xs font-medium">{totalLabel}</span>
          <span className="font-bold tabular-nums text-[13px]">
            {currency === "THB" ? "฿" : currency}
            {Math.round(total).toLocaleString()}
          </span>
        </div>
      )}
    </section>
  );
}

function TxRow({ tx, currency }: { tx: Tx; currency: string }) {
  const note = tx.note ?? "";
  const catName = tx.category?.name ?? "";

  // Bind ids into the actions so the client components just see a
  // single-arg function. Server-side closures make the txId
  // unforgeable from the client.
  async function amountAction(amount: number) {
    "use server";
    return updateTransactionAmountAction(tx.id, amount);
  }
  async function noteAction(next: string) {
    "use server";
    return updateTransactionNoteAction(tx.id, next);
  }
  async function deleteAction() {
    "use server";
    return deleteTransactionAction(tx.id);
  }

  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <div className="flex-1 min-w-0">
        <InlineNote initial={note} placeholder={catName || "—"} action={noteAction} />
        {catName && <p className="text-[11px] text-(--muted) leading-tight truncate">{catName}</p>}
      </div>
      <InlineAmount
        initial={tx.amount}
        currency={currency}
        action={amountAction}
      />
      <DeleteRowButton action={deleteAction} confirmKey="transactions.deleteConfirm" />
    </li>
  );
}

function RuleRow({
  rule,
  currency,
  displayAmount,
  viewedIsCurrent,
  viewedIsFuture,
}: {
  rule: Rule;
  currency: string;
  /** Pre-computed amount for the viewed month — already accounts for
   *  past/future buckets resetting to 0 and for matching tx lookup. */
  displayAmount: number;
  viewedIsCurrent: boolean;
  viewedIsFuture: boolean;
}) {
  const note = rule.note ?? "";
  const catName = rule.category?.name ?? "";

  // Amount routing — three flavours, all editable inline:
  //   1. Fixed rule (rule.amount != null)
  //        → updateRecurringAmountAction (changes rule template)
  //   2. Variable rule, applied this period (we already have a fill)
  //        → updateRecurringFillAmountAction (corrects the existing
  //          tx + updates last_fill_amount; does NOT create a dup)
  //   3. Variable rule, not yet applied
  //        → fillPendingRecurringAmountAction (creates the tx)
  const isVariable = rule.amount === null;
  const appliedAndFilled =
    isVariable &&
    isAppliedThisPeriod(rule.last_run_at, rule.period) &&
    rule.last_fill_amount !== null;
  // Initial value the input shows:
  //   - Future month → 0 across the board (the user can't fill ahead)
  //   - Current month + fixed → rule.amount
  //   - Current month + variable + applied → last_fill_amount
  //   - Current month + variable + pending → null (dashed input)
  //   - Past month → displayAmount (matches what really happened),
  //     0 falls through to a read-only-looking zero
  const initialAmount: number | null = viewedIsFuture
    ? 0
    : viewedIsCurrent
    ? isVariable
      ? appliedAndFilled
        ? rule.last_fill_amount
        : null
      : rule.amount
    : displayAmount;

  async function amountAction(amount: number) {
    "use server";
    if (!isVariable) {
      return updateRecurringAmountAction(rule.id, amount);
    }
    if (appliedAndFilled) {
      return updateRecurringFillAmountAction(rule.id, amount);
    }
    return fillPendingRecurringAmountAction(rule.id, amount);
  }
  async function noteAction(next: string) {
    "use server";
    return updateRecurringNoteAction(rule.id, next);
  }
  async function deleteAction() {
    "use server";
    return deleteRecurringAction(rule.id);
  }

  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <span
        className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "color-mix(in srgb, var(--peach-soft) 50%, var(--card))",
        }}
        title="recurring"
        aria-label="recurring"
      >
        <EmojiOrIcon value={rule.category?.icon} fallback="recurring" size={12} />
      </span>
      <div className="flex-1 min-w-0">
        <InlineNote initial={note} placeholder={catName || "—"} action={noteAction} />
        <p className="text-[11px] text-(--muted) leading-tight truncate">
          {catName || rule.period}
        </p>
      </div>
      <InlineAmount
        initial={initialAmount}
        currency={currency}
        action={amountAction}
      />
      <DeleteRowButton action={deleteAction} confirmKey="recurring.deleteConfirm" />
    </li>
  );
}
