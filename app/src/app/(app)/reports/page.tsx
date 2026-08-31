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
  updateRecurringNoteAction,
  updateTransactionAmountAction,
  updateTransactionNoteAction,
} from "./actions";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import {
  setRecurringMonthAmountAction,
  setRecurringMonthNoteAction,
  toggleRecurringAction,
} from "@/app/(app)/recurring/actions";
import { InlineAmount } from "./inline-amount";
import { MonthNoteChip } from "./month-note-chip";
import { InlineNote } from "./inline-note";
import { DeleteRowButton, PauseRuleButton } from "./row-actions";
import { AddRow } from "./add-row";
import { ImportImageButton } from "./import-image-button";
import { monthNoteKey } from "@/lib/recurring-month-note";

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
  // `applyDueRecurring` tag those rows with `recurring_id`, and
  // legacy materialised rows carry a "[ค่าประจำ]" note prefix. Both
  // surface above as their parent rule row (the per-month override
  // tx is what drives the displayed amount), so showing them again
  // as a "regular" tx below would double-count visually.
  const isRecurringTx = (tx: (typeof allTxs)[number]) =>
    tx.recurring_id !== null ||
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

  // Per-rule override tx for the viewed month. Strong link via
  // `recurring_id` (set on new rows by setRecurringMonthAmount and
  // by the cron fill paths); falls back to category+prefix for any
  // legacy materialised rows that pre-date `recurring_id`.
  function findRuleTx(r: (typeof activeRecurring)[number]) {
    const byId = allTxs.find(
      (tx) => tx.recurring_id === r.id && tx.kind === r.kind,
    );
    if (byId) return byId;
    return allTxs.find(
      (tx) =>
        tx.recurring_id === null &&
        isRecurringTx(tx) &&
        tx.kind === r.kind &&
        tx.category_id === r.category_id,
    );
  }
  // Amount the row + the section total should attribute to this rule
  // for the viewed month. The override tx (if any) wins — including
  // 0-amount rows (skipped → "-", or a real "฿0") — so editing one
  // month never leaks into another, and a skipped month correctly
  // contributes 0 to the section total.
  function ruleRowAmount(r: (typeof activeRecurring)[number]) {
    const matched = findRuleTx(r);
    if (matched) return matched.skipped ? 0 : matched.amount;
    if (viewedIsFuture) return 0;
    if (viewedIsCurrent && r.amount !== null) return r.amount;
    // Past month or current-month variable bill with no override —
    // the rule hasn't been materialised here yet, so it contributes 0.
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
      {/* Header — matches /transactions: left-aligned bold title, no
          back button (the bottom nav already covers navigation). */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold truncate">{t("reports.title")}</h1>
        <ImportImageButton year={year} month={month} currency={currency} />
      </div>

      {/* Month switcher */}
      <div className="rounded-[22px] soft-raised flex items-center justify-between px-3 py-2">
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
      <div className="rounded-[22px] soft-raised grid grid-cols-3 divide-x divide-(--soft-shade)/45">
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
        totalLabel={t("reports.totalIncome")}
        viewedIsCurrent={viewedIsCurrent}
        viewedYear={year}
        viewedMonth={month}
        findRuleTx={findRuleTx}
      />

      {/* Expense section */}
      <ReportSection
        kind="expense"
        title={t("transactions.totalExpense")}
        rules={expenseRules}
        txs={expenseTxs}
        total={totalExpense}
        currency={currency}
        totalLabel={t("reports.totalExpense")}
        viewedIsCurrent={viewedIsCurrent}
        viewedYear={year}
        viewedMonth={month}
        findRuleTx={findRuleTx}
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
  totalLabel,
  viewedIsCurrent,
  viewedYear,
  viewedMonth,
  findRuleTx,
}: {
  kind: "income" | "expense";
  title: string;
  rules: Rule[];
  txs: Tx[];
  total: number;
  currency: string;
  totalLabel: string;
  viewedIsCurrent: boolean;
  viewedYear: number;
  viewedMonth: number;
  findRuleTx: (r: Rule) => Tx | undefined;
}) {
  const headerColor = kind === "income" ? "#16A34A" : "#DC2626";
  const hasRows = rules.length > 0 || txs.length > 0;

  return (
    <section className="rounded-[22px] soft-raised overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-2.5 soft-well">
        <span
          className="h-4 w-1.5 rounded-full shrink-0"
          style={{ background: headerColor }}
          aria-hidden
        />
        <span className="font-semibold text-xs">{title}</span>
      </header>

      <ul className="divide-y divide-(--soft-shade)/45">
        {/* Recurring rules first — surfaces the "expected" line items
            at the top of each section so the user can scrub through
            them without diving into /recurring. */}
        {rules.map((r) => (
          <RuleRow
            key={`r-${r.id}`}
            rule={r}
            currency={currency}
            matched={findRuleTx(r)}
            viewedIsCurrent={viewedIsCurrent}
            viewedYear={viewedYear}
            viewedMonth={viewedMonth}
          />
        ))}
        {/* Tap-to-add. Expense section sits the row immediately after the
            recurring rules (the user wants it adjacent to "รายการประจำ"
            so they can add one-off expenses right where the recurring
            list ends); income keeps it at the very bottom. The new tx
            still lands on day 1 of the viewed month with no category. */}
        {kind === "expense" && (
          <AddRow
            kind={kind}
            year={viewedYear}
            month={viewedMonth}
            currency={currency}
          />
        )}
        {txs.map((tx) => (
          <TxRow key={tx.id} tx={tx} currency={currency} />
        ))}
        {kind === "income" && (
          <AddRow
            kind={kind}
            year={viewedYear}
            month={viewedMonth}
            currency={currency}
          />
        )}
      </ul>

      {hasRows && (
        <div
          className="px-3 py-1.5 flex items-center justify-between border-t border-(--soft-shade)/45"
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
  matched,
  viewedIsCurrent,
  viewedYear,
  viewedMonth,
}: {
  rule: Rule;
  currency: string;
  /** Per-month override tx (if any) — drives both the displayed value
   *  and the skipped state. Absent = no override yet for this month. */
  matched: Tx | undefined;
  viewedIsCurrent: boolean;
  viewedYear: number;
  viewedMonth: number;
}) {
  const note = rule.note ?? "";
  const catName = rule.category?.name ?? "";
  // The note for the month on screen — not the rule's own note above.
  const monthNote = rule.month_notes[monthNoteKey(viewedYear, viewedMonth)] ?? "";

  // Per-month override model: every edit on /reports writes (or
  // updates) one tx in the viewed month. The rule template is never
  // touched here, so changing this month's number can't bleed into
  // any other month's render.
  const isVariable = rule.amount === null;
  // Skipped is read directly off the override tx — `last_fill_amount`
  // is no longer the source of truth here because it can only describe
  // one period at a time (and so couldn't distinguish a skipped past
  // month from a skipped current month).
  const isSkipped = matched?.skipped === true;
  // Initial value the input shows. If an override exists, use it.
  // Otherwise: current-month fixed rules show the template as a
  // pre-fill (so the user can edit it down without retyping); variable
  // pending rules show the dashed empty state; everything else falls
  // back to 0.
  // No override tx for this month means nobody has filled it in, and
  // the cell says so with "-". It used to resolve to 0 for past and
  // future months, which put a column of ฿0 next to real amounts and
  // read as "this month cost nothing". The one value still pre-filled
  // is a fixed-amount rule in the CURRENT month: the template amount,
  // so the user can edit it down without retyping it.
  const initialAmount: number | null = matched
    ? matched.skipped
      ? 0
      : matched.amount
    : viewedIsCurrent && !isVariable
    ? rule.amount
    : null;

  async function amountAction(amount: number) {
    "use server";
    return setRecurringMonthAmountAction(rule.id, {
      year: viewedYear,
      month: viewedMonth,
      amount,
      skipped: false,
    });
  }
  async function skipAction() {
    "use server";
    return setRecurringMonthAmountAction(rule.id, {
      year: viewedYear,
      month: viewedMonth,
      amount: 0,
      skipped: true,
    });
  }
  async function noteAction(next: string) {
    "use server";
    return updateRecurringNoteAction(rule.id, next);
  }
  async function monthNoteAction(next: string) {
    "use server";
    return setRecurringMonthNoteAction(rule.id, {
      year: viewedYear,
      month: viewedMonth,
      note: next,
    });
  }
  async function pauseAction() {
    "use server";
    // Pause instead of delete — the row disappears from /reports
    // (which only renders active rules) but the rule survives and can
    // be re-enabled on /recurring. Rule deletion now lives only on
    // /recurring, where it soft-deletes with an undo toast.
    return toggleRecurringAction(rule.id, false);
  }

  return (
    <li
      className="flex items-center gap-2 px-3 py-1.5"
      // Recurring rows get a soft peach wash so the "รายการประจำ" lines
      // read as a distinct band above the one-off transactions below.
      style={{
        background: "color-mix(in srgb, var(--peach-soft) 48%, var(--card))",
      }}
    >
      <span
        className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "color-mix(in srgb, var(--peach-soft) 75%, var(--card))",
        }}
        title="recurring"
        aria-label="recurring"
      >
        <EmojiOrIcon value={rule.category?.icon} fallback="recurring" size={12} />
      </span>
      <div className="flex-1 min-w-0">
        {/* Title line carries two different notes: <InlineNote> edits
            the rule's own name (every month sees it), the chip beside
            it belongs to the month on screen. min-w-0 on the title so
            a long name yields to the chip instead of pushing it out. */}
        <div className="flex items-center gap-1.5 min-w-0">
          <InlineNote
            hug
            initial={note}
            placeholder={catName || "—"}
            action={noteAction}
          />
          <MonthNoteChip
            key={`note-${viewedYear}-${viewedMonth}`}
            initial={monthNote}
            action={monthNoteAction}
          />
        </div>
        <p className="text-[11px] text-(--muted) leading-tight truncate">
          {catName || rule.period}
        </p>
      </div>
      {/* Key on the resolved initial + skipped flag so navigating
          between months actually remounts the inline editor —
          without it, React keeps the prior month's local useState
          (the input would keep showing 2,438 when the next month's
          value is 0). */}
      <InlineAmount
        key={`amt-${viewedYear}-${viewedMonth}-${initialAmount ?? "null"}-${isSkipped ? "skip" : "ok"}`}
        initial={initialAmount}
        currency={currency}
        action={amountAction}
        onSkip={skipAction}
        skipped={isSkipped}
      />
      <PauseRuleButton action={pauseAction} />
    </li>
  );
}
