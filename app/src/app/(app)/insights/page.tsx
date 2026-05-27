import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listTransactions, aggregateMonthSummary } from "@/lib/transactions";
import { compareMonths } from "@/lib/insights";
import { intlLocale } from "@/lib/locale-format";
import { nowInBusinessTz } from "@/lib/business-tz";
import { resolveRange, type RangeKey } from "@/lib/date-range";
import { Mascot } from "@/components/mascots";
import { JtIcon } from "@/components/icons";
import { formatCurrencyCompact } from "@/lib/utils";
import { ExpenseBreakdownCard } from "./expense-breakdown-card";

const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 65%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 30%, var(--card)) 100%)";

type Period = "week" | "month" | "year";

export default async function InsightsPage({
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
  const period: Period =
    sp.p === "week" || sp.p === "year" ? sp.p : "month";

  const range = resolveRange(period as RangeKey);
  const txs = await listTransactions({
    ledgerId,
    from: range.from,
    to: range.to,
    limit: 5000,
  });
  const summary = aggregateMonthSummary(txs);
  const expenseRows = summary.byCategory
    .filter((c) => c.kind === "expense")
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
      category_id: c.category_id,
      name: c.name,
      icon: c.icon,
      total: c.total,
    }));
  const expenseTxs = txs.filter((tx) => tx.kind === "expense");

  // Mascot card shows only when there's no previous-month data to
  // compare against — i.e., the user's first month on the app.
  const now = nowInBusinessTz();
  const compare = await compareMonths(
    ledgerId,
    now.getUTCFullYear(),
    now.getUTCMonth() + 1
  );
  const hasBaseline = compare.prev.expense > 0 || compare.prev.income > 0;

  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currency = ledger.currency;

  const periodTitle =
    period === "week"
      ? t("insights.expenseWeek")
      : period === "year"
      ? t("insights.expenseYear")
      : t("insights.expenseMonth");
  const periodLabels: Record<Period, string> = {
    week: t("insights.periodWeek"),
    month: t("insights.periodMonth"),
    year: t("insights.periodYear"),
  };

  const cashExpense = summary.byPaymentMethod.cash.expense;
  const transferExpense = summary.byPaymentMethod.transfer.expense;
  const unspecifiedExpense = summary.byPaymentMethod.unspecified.expense;
  const totalPaid = cashExpense + transferExpense + unspecifiedExpense;
  const pctOf = (v: number) =>
    totalPaid > 0 ? Math.round((v / totalPaid) * 100) : 0;

  return (
    <div className="max-w-md mx-auto pb-28 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("insights.title")}</h1>
        <p className="text-sm text-(--muted) mt-0.5">{monthLabel}</p>
      </div>

      {!hasBaseline && (
        <section
          className="rounded-2xl px-4 py-3 border flex items-center gap-3"
          style={{
            background: PEACH_GRADIENT,
            borderColor: "color-mix(in srgb, var(--peach-strong) 25%, transparent)",
          }}
        >
          <div className="h-14 w-14 rounded-full bg-(--card)/70 flex items-center justify-center shrink-0">
            <Mascot size={48} idPrefix="insights-mascot" />
          </div>
          <p className="text-sm font-medium text-(--foreground)/85">
            {t("insights.noBaseline")}
          </p>
        </section>
      )}

      <ExpenseBreakdownCard
        rows={expenseRows}
        txs={expenseTxs}
        currency={currency}
        fmtLocale={fmtLocale}
        period={period}
        periodLabels={periodLabels}
        periodTitle={periodTitle}
        topCategoryLabel={t("insights.topCategory")}
        noExpenseLabel={t("dashboard.noExpensePrompt")}
        donutLabel={t("dashboard.donutSpent")}
      />

      {/* Payment method summary — 2-col cards */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">
            {t("dashboard.paymentMethodTitle")}
          </h2>
          {unspecifiedExpense > 0 && (
            <span className="text-[11px] text-(--muted)">
              {t("dashboard.paymentMethodUnspecified")}{" "}
              {formatCurrencyCompact(unspecifiedExpense, currency, fmtLocale)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PaymentCard
            icon={<JtIcon name="banknote" size={20} />}
            label={t("transactions.paymentCash")}
            amount={cashExpense}
            pct={pctOf(cashExpense)}
            currency={currency}
            fmtLocale={fmtLocale}
            ofExpenseLabel={t("insights.ofExpense")}
          />
          <PaymentCard
            icon={<JtIcon name="landmark" size={20} />}
            label={t("transactions.paymentTransfer")}
            amount={transferExpense}
            pct={pctOf(transferExpense)}
            currency={currency}
            fmtLocale={fmtLocale}
            ofExpenseLabel={t("insights.ofExpense")}
          />
        </div>
      </section>
    </div>
  );
}

function PaymentCard({
  icon,
  label,
  amount,
  pct,
  currency,
  fmtLocale,
  ofExpenseLabel,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  pct: number;
  currency: string;
  fmtLocale: string;
  ofExpenseLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) px-4 py-3">
      <div className="flex items-center gap-2 text-(--muted)">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">
        {formatCurrencyCompact(amount, currency, fmtLocale)}
      </p>
      <p className="mt-1 text-[11px] text-(--muted)">
        {pct}% {ofExpenseLabel}
      </p>
    </div>
  );
}
