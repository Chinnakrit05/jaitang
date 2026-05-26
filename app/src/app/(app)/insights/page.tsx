import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listTransactions, aggregateMonthSummary } from "@/lib/transactions";
import { compareMonths } from "@/lib/insights";
import { intlLocale } from "@/lib/locale-format";
import { nowInBusinessTz } from "@/lib/business-tz";
import { resolveRange, type RangeKey } from "@/lib/date-range";
import { Mascot } from "@/components/mascots";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { Donut, type DonutSlice } from "@/components/donut";
import { formatCurrencyCompact } from "@/lib/utils";

const CATEGORY_PALETTE = [
  "#FF7BAC",
  "#A78BFA",
  "#FBBF24",
  "#FB923C",
  "#60A5FA",
  "#34D399",
];

const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, #F9D5B4 65%, var(--card)) 0%, color-mix(in srgb, #F4B58A 30%, var(--card)) 100%)";
const PEACH_STRONG = "#E89A6A";

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
    .sort((a, b) => b.total - a.total);
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0);

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

  // Pre-rank top category for the footer chip.
  const top = expenseRows[0];
  const topPct =
    top && totalExpense > 0 ? Math.round((top.total / totalExpense) * 100) : 0;

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
            borderColor: "color-mix(in srgb, #E89A6A 25%, transparent)",
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

      {/* Expense breakdown card */}
      <section
        className="rounded-3xl px-5 py-5 border space-y-4"
        style={{
          background: PEACH_GRADIENT,
          borderColor: "color-mix(in srgb, #E89A6A 25%, transparent)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{periodTitle}</h2>
          <PeriodToggle active={period} labels={periodLabels} />
        </div>

        {expenseRows.length === 0 ? (
          <div className="rounded-2xl bg-(--card) px-4 py-6 text-center text-sm text-(--muted)">
            {t("dashboard.noExpensePrompt")}
          </div>
        ) : (
          <div className="rounded-2xl bg-(--card) px-4 py-4 flex items-center gap-4">
            <div className="shrink-0">
              <Donut
                data={
                  expenseRows.slice(0, 6).map((r, i) => ({
                    value: r.total,
                    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                  })) satisfies DonutSlice[]
                }
                size={120}
                label={t("dashboard.donutSpent")}
                centerValue={
                  totalExpense > 0
                    ? formatCurrencyCompact(totalExpense, currency, fmtLocale)
                    : "—"
                }
              />
            </div>
            <ul className="flex-1 space-y-2 min-w-0">
              {expenseRows.slice(0, 5).map((r, i) => {
                const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
                const rawPct =
                  totalExpense > 0 ? (r.total / totalExpense) * 100 : 0;
                return (
                  <li key={r.category_id ?? `row-${i}`} className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <EmojiOrIcon value={r.icon} fallback="sparkle" size={14} />
                      <span className="truncate text-[13px] flex-1">
                        {r.name}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0">
                        {Math.round(rawPct)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 pl-5">
                      <div
                        className="h-1 rounded-full flex-1 overflow-hidden"
                        style={{
                          background:
                            "color-mix(in srgb, var(--foreground) 6%, transparent)",
                        }}
                      >
                        <div
                          className="h-full rounded-full bar-fill"
                          style={
                            {
                              background: color,
                              "--bar-target": `${rawPct}%`,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <span className="text-[10px] text-(--muted) tabular-nums shrink-0">
                        {formatCurrencyCompact(r.total, currency, fmtLocale)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {top && (
          <div className="rounded-2xl bg-(--card)/70 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-(--foreground)/80">
              {t("insights.topCategory")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {top.name} · {topPct}%
            </span>
          </div>
        )}
      </section>

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

function PeriodToggle({
  active,
  labels,
}: {
  active: Period;
  labels: Record<Period, string>;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-full bg-(--card)/70">
      <PeriodLink p="week" active={active} label={labels.week} />
      <PeriodLink p="month" active={active} label={labels.month} />
      <PeriodLink p="year" active={active} label={labels.year} />
    </div>
  );
}

function PeriodLink({
  p,
  active,
  label,
}: {
  p: Period;
  active: Period;
  label: string;
}) {
  const isActive = p === active;
  return (
    <Link
      href={p === "month" ? "/insights" : `/insights?p=${p}`}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
      style={
        isActive
          ? { background: "white", color: PEACH_STRONG }
          : { color: "color-mix(in srgb, #6E3A12 75%, transparent)" }
      }
    >
      {label}
    </Link>
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
