import { TrendingDown, TrendingUp, Wallet, Plus } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { aggregateMonthSummary, listTransactions } from "@/lib/transactions";
import { listAccounts } from "@/lib/accounts";
import { resolveRange, type RangeKey } from "@/lib/date-range";
import { TransactionList } from "@/components/transaction-list";
import { ExpenseByCategoryChart, DailyTrendChart } from "@/components/dashboard-charts";
import { PaymentMethodBreakdown } from "@/components/payment-method-breakdown";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { DashboardCurrencyToggle } from "@/components/dashboard-currency-toggle";
import { DashboardAccountBalances } from "@/components/dashboard-account-balances";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { SUPPORTED_CODES } from "@/lib/currencies";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, { ledgerId, ledger, user }, t, locale] = await Promise.all([
    searchParams,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const name = user.name?.split(" ")[0] ?? "you";
  const currency = ledger.currency;

  // Default to "month" so the home screen still feels like the monthly
  // overview new users expect; any other range comes from a click on the
  // pills below the greeting.
  const range = resolveRange(sp.range);
  const rangeKey = range.key;

  // ?cur=JPY filters the dashboard to JPY-only rows. Defended against
  // bad input — only allow our supported list, otherwise treat as "no
  // filter" rather than 500.
  const curParam = sp.cur;
  const filterCurrency =
    curParam &&
    curParam !== ledger.currency &&
    SUPPORTED_CODES.has(curParam)
      ? curParam
      : null;

  // Pull the rows in this window + the last 5 (separate query — recent
  // transactions on the home page should not be limited by the filter).
  // Account balances ride alongside since the widget is always visible.
  const [items, recent, accountBalances] = await Promise.all([
    listTransactions({
      ledgerId,
      from: range.from,
      to: range.to,
      limit: 5000,
    }),
    listTransactions({ ledgerId, limit: 5 }),
    listAccounts(ledgerId, { includeArchived: false }),
  ]);
  const summary = aggregateMonthSummary(items, filterCurrency);
  // Distinct foreign currencies present in this period — drives whether
  // the toggle row even renders.
  const availableForeignCurrencies = Array.from(
    new Set(
      items
        .map((tx) => tx.fx_currency)
        .filter((c): c is string => !!c && c !== ledger.currency)
    )
  ).sort();
  // The active filter shapes how cards format their value: home or native.
  const displayCurrency = filterCurrency ?? ledger.currency;

  // Range-specific subtitle. For single-day windows we show the date so the
  // user can confirm "เมื่อวาน" wasn't the wrong day; for month windows we
  // keep the original "ภาพรวม{month}" phrasing.
  const subtitle = buildSubtitle(rangeKey, range.from, fmtLocale, t);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("dashboard.greeting", { name })}
          </h1>
          <p className="text-sm text-(--muted) flex items-center gap-2">
            <span className="inline-block h-1 w-6 rounded-full bg-(--accent) shrink-0" />
            {subtitle}
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm cta-primary"
        >
          <Plus size={18} />
          {t("dashboard.addTransaction")}
        </Link>
      </div>

      <DashboardRangeFilter activeKey={rangeKey} />

      {availableForeignCurrencies.length > 0 && (
        <DashboardCurrencyToggle
          homeCurrency={ledger.currency}
          available={availableForeignCurrencies}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label={t("dashboard.incomeMonth")}
          value={summary.income}
          icon={<TrendingUp size={20} />}
          tone="income"
          currency={displayCurrency}
          fmtLocale={fmtLocale}
        />
        <SummaryCard
          label={t("dashboard.expenseMonth")}
          value={summary.expense}
          icon={<TrendingDown size={20} />}
          tone="expense"
          currency={displayCurrency}
          fmtLocale={fmtLocale}
        />
        <SummaryCard
          label={t("dashboard.balanceCard")}
          value={summary.balance}
          icon={<Wallet size={20} />}
          tone={summary.balance >= 0 ? "balance" : "expense"}
          showSign
          currency={displayCurrency}
          fmtLocale={fmtLocale}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">{t("dashboard.expenseByCategory")}</h2>
          <ExpenseByCategoryChart
            summary={summary}
            currency={displayCurrency}
            fmtLocale={fmtLocale}
          />
        </section>

        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">{t("dashboard.dailyTrend")}</h2>
          <DailyTrendChart
            summary={summary}
            currency={displayCurrency}
            fmtLocale={fmtLocale}
          />
        </section>
      </div>

      <DashboardAccountBalances
        accounts={accountBalances}
        homeCurrency={ledger.currency}
        fmtLocale={fmtLocale}
      />

      <PaymentMethodBreakdown
        summary={summary}
        currency={displayCurrency}
        fmtLocale={fmtLocale}
      />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t("dashboard.recent")}</h2>
          <Link href="/transactions" className="text-sm text-(--accent) hover:underline">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        <TransactionList
          items={recent}
          showAttribution={!ledger.is_personal}
          currency={currency}
        />
      </section>
    </div>
  );
}

/**
 * Build the dashboard subtitle. For single-day ranges we render the actual
 * date so users can sanity-check that "เมื่อวาน" really means yesterday in
 * their timezone. For everything else we fall back to the static
 * `transactions.rangeLabels.<key>` string.
 */
function buildSubtitle(
  rangeKey: RangeKey,
  rangeFrom: string | undefined,
  fmtLocale: string,
  t: (key: string, vars?: Record<string, string>) => string
): string {
  // Month overview fallback — preserves the original copy for the default view.
  if (rangeKey === "month") {
    const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
      month: "long",
      year: "numeric",
    }).format(new Date());
    return t("dashboard.monthOverview", { month: monthLabel });
  }

  if (
    (rangeKey === "today" ||
      rangeKey === "yesterday" ||
      rangeKey === "day_before") &&
    rangeFrom
  ) {
    const dayLabel = new Intl.DateTimeFormat(fmtLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      weekday: "long",
    }).format(new Date(rangeFrom));
    return `${t(`transactions.rangeLabels.${rangeKey}`)} • ${dayLabel}`;
  }

  return t(`transactions.rangeLabels.${rangeKey}`);
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  showSign,
  currency,
  fmtLocale,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "income" | "expense" | "balance";
  showSign?: boolean;
  currency: string;
  fmtLocale: string;
}) {
  const toneClass =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--accent)";

  const sign = showSign ? (value >= 0 ? "+" : "−") : "";

  return (
    <div className="group card-hover rounded-2xl border border-(--border) bg-(--card) p-5 hover:border-(--muted)/40">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-(--muted) mb-3">
        <span className="font-medium">{label}</span>
        <span className={`${toneClass} opacity-70 group-hover:opacity-100 transition`}>
          {icon}
        </span>
      </div>
      <div className={`text-2xl sm:text-3xl font-semibold tabular-nums ${toneClass}`}>
        {value === 0 ? "—" : `${sign}${formatCurrency(Math.abs(value), currency, fmtLocale)}`}
      </div>
    </div>
  );
}
