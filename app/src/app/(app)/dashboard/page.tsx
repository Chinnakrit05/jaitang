import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { aggregateMonthSummary, listTransactions } from "@/lib/transactions";
import { listAccounts } from "@/lib/accounts";
import { listBudgets } from "@/lib/budgets";
import { resolveRange, type RangeKey } from "@/lib/date-range";
import { DailyTrendChart } from "@/components/dashboard-charts";
import { PaymentMethodBreakdown } from "@/components/payment-method-breakdown";
import { CategorySummary } from "@/components/category-summary";
import { RecentTransactionsCompact } from "@/components/recent-transactions-compact";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { DashboardCurrencyToggle } from "@/components/dashboard-currency-toggle";
import { DashboardAccountBalances } from "@/components/dashboard-account-balances";
import { DashboardHero } from "@/components/dashboard-hero";
import {
  DashboardWidgetShell,
  type WidgetMap,
} from "@/components/dashboard-widget-shell";
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

  // Default to "today" so the home screen mirrors what the user is
  // most likely curious about — what they spent today. Other ranges
  // come from a click on the pills below the greeting; URL ?range=
  // wins when present.
  const range = resolveRange(sp.range ?? "today");
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
  // Account balances + monthly budgets ride alongside since the hero
  // card needs the budget cap to draw its mood progress bar.
  const [items, recent, accountBalances, budgets] = await Promise.all([
    listTransactions({
      ledgerId,
      from: range.from,
      to: range.to,
      limit: 5000,
    }),
    listTransactions({ ledgerId, limit: 5 }),
    listAccounts(ledgerId, { includeArchived: false }),
    listBudgets(ledgerId).catch(() => []),
  ]);
  // Sum of per-category caps for this ledger — used as the budget bar's
  // denominator on the hero. 0 means "no budget set" (bar renders muted).
  const budgetCap = budgets.reduce((sum, b) => sum + b.amount, 0);
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

  // Month label for the hero card's month-nav line — formatted in the
  // user's locale so Thai readers see "พฤษภาคม 2569" while others see
  // "May 2026" etc.
  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6 fade-rise">
      <DashboardHero
        name={name}
        avatarUrl={user.image ?? null}
        income={summary.income}
        expense={summary.expense}
        balance={summary.balance}
        budgetCap={budgetCap}
        currency={displayCurrency}
        fmtLocale={fmtLocale}
        monthLabel={monthLabel}
        // TODO(streak): wire to a real per-user counter once the server
        // tracks daily activity. Hidden when 0 / undefined.
        streakDays={undefined}
      />

      <p className="text-sm text-(--muted) flex items-center gap-2">
        <span className="inline-block h-1 w-6 rounded-full bg-(--accent) shrink-0" />
        {subtitle}
      </p>

      <DashboardRangeFilter activeKey={rangeKey} />

      {availableForeignCurrencies.length > 0 && (
        <DashboardCurrencyToggle
          homeCurrency={ledger.currency}
          available={availableForeignCurrencies}
        />
      )}

      {/* Customizable widgets — order + visibility persist per-user via
          localStorage. The hero card above the widget shell now owns
          income / expense / balance, so the old `summary` 3-up grid was
          retired. */}
      {(() => {
        const widgets: WidgetMap = {
          expenseByCategory: (
            <CategorySummary
              summary={summary}
              currency={displayCurrency}
              fmtLocale={fmtLocale}
            />
          ),
          dailyTrend: (
            <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
              <h2 className="section-heading font-semibold mb-4">
                {t("dashboard.dailyTrend")}
              </h2>
              <DailyTrendChart
                summary={summary}
                currency={displayCurrency}
                fmtLocale={fmtLocale}
              />
            </section>
          ),
          accountBalances: (
            <DashboardAccountBalances
              accounts={accountBalances}
              homeCurrency={ledger.currency}
              fmtLocale={fmtLocale}
            />
          ),
          paymentMethod: (
            <PaymentMethodBreakdown
              summary={summary}
              currency={displayCurrency}
              fmtLocale={fmtLocale}
            />
          ),
          recent: (
            <RecentTransactionsCompact
              items={recent}
              currency={currency}
              fmtLocale={fmtLocale}
              showTrip={!ledger.is_personal}
            />
          ),
        };
        return <DashboardWidgetShell widgets={widgets} />;
      })()}
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

