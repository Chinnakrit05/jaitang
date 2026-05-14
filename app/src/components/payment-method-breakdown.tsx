import { getTranslations } from "next-intl/server";
import { JtIcon } from "@/components/icons";
import type { MonthSummary, PaymentMethodTotals } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

/**
 * Compact breakdown of a month's income / expense per payment method.
 * Server component — purely presentational, takes the precomputed totals
 * from `getMonthSummary`. Hides the "unspecified" row when there isn't any,
 * so a fully-tagged ledger doesn't show a noisy zero line.
 */
export async function PaymentMethodBreakdown({
  summary,
  currency,
  fmtLocale,
}: {
  summary: MonthSummary;
  currency: string;
  fmtLocale: string;
}) {
  const t = await getTranslations();
  const { cash, transfer, unspecified } = summary.byPaymentMethod;
  const hasUnspecified =
    unspecified.income > 0 || unspecified.expense > 0;

  const allEmpty =
    cash.income + cash.expense + transfer.income + transfer.expense === 0 &&
    !hasUnspecified;

  return (
    <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
      <h2 className="font-semibold mb-4">
        {t("dashboard.paymentMethodTitle")}
      </h2>

      {allEmpty ? (
        <p className="text-sm text-(--muted)">
          {t("dashboard.paymentMethodEmpty")}
        </p>
      ) : (
        <div className="space-y-3">
          <Row
            icon={<JtIcon name="banknote" size={18} />}
            label={t("transactions.paymentCash")}
            totals={cash}
            currency={currency}
            fmtLocale={fmtLocale}
            incomeLabel={t("transactions.totalIncome")}
            expenseLabel={t("transactions.totalExpense")}
          />
          <Row
            icon={<JtIcon name="landmark" size={18} />}
            label={t("transactions.paymentTransfer")}
            totals={transfer}
            currency={currency}
            fmtLocale={fmtLocale}
            incomeLabel={t("transactions.totalIncome")}
            expenseLabel={t("transactions.totalExpense")}
          />
          {hasUnspecified && (
            <Row
              icon={<JtIcon name="help-circle" size={18} />}
              label={t("dashboard.paymentMethodUnspecified")}
              totals={unspecified}
              currency={currency}
              fmtLocale={fmtLocale}
              incomeLabel={t("transactions.totalIncome")}
              expenseLabel={t("transactions.totalExpense")}
              hint={t("dashboard.paymentMethodUnspecifiedHint")}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  icon,
  label,
  totals,
  currency,
  fmtLocale,
  incomeLabel,
  expenseLabel,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  totals: PaymentMethodTotals;
  currency: string;
  fmtLocale: string;
  incomeLabel: string;
  expenseLabel: string;
  hint?: string;
}) {
  const hasIncome = totals.income > 0;
  const hasExpense = totals.expense > 0;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-(--border) bg-(--background) px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-(--muted) shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {hint && (
            <div className="text-xs text-(--muted) mt-0.5 truncate">{hint}</div>
          )}
        </div>
      </div>
      <div className="text-right text-xs tabular-nums leading-tight shrink-0">
        {hasIncome && (
          <div className="text-(--income)">
            <span className="text-(--muted) mr-1">{incomeLabel}</span>+
            {formatCurrency(totals.income, currency, fmtLocale)}
          </div>
        )}
        {hasExpense && (
          <div className="text-(--expense)">
            <span className="text-(--muted) mr-1">{expenseLabel}</span>−
            {formatCurrency(totals.expense, currency, fmtLocale)}
          </div>
        )}
        {!hasIncome && !hasExpense && <div className="text-(--muted)">—</div>}
      </div>
    </div>
  );
}
