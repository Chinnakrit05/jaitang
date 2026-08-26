import { DailyTrendChart } from "@/components/dashboard-charts";
import { PaymentMethodBreakdown } from "@/components/payment-method-breakdown";
import { CategorySummary } from "@/components/category-summary";
import { RecentTransactionsCompact } from "@/components/recent-transactions-compact";
import { DashboardAccountBalances } from "@/components/dashboard-account-balances";
import { DashboardHero } from "@/components/dashboard-hero";
import {
  DashboardWidgetShell,
  type WidgetMap,
} from "@/components/dashboard-widget-shell";
import { DashboardLayoutProvider } from "@/components/dashboard-layout-context";
import type { AccountWithBalance } from "@/lib/accounts";
import type { MonthSummary, TransactionWithCategory } from "@/lib/types";

/**
 * Public preview of the whole dashboard, hero through to the last
 * widget. Sits outside the `(app)` auth group like the other preview
 * routes so the composed page can be looked at without a Supabase
 * session — `/hero-preview` only covers the hero and the category
 * card, which is not enough to judge a page-wide surface treatment.
 *
 * A server component on purpose: every widget except the shell is one
 * too, and they call getTranslations() directly.
 */

const fmtLocale = "th-TH";
const currency = "THB";

const summary: MonthSummary = {
  income: 62_000,
  expense: 37_820,
  balance: 24_180,
  byCategory: [
    { category_id: "c1", name: "อาหาร", icon: "🍜", color: "#f97316", kind: "expense", total: 12_450 },
    { category_id: "c2", name: "เดินทาง", icon: "🚕", color: "#3b82f6", kind: "expense", total: 6_200 },
    { category_id: "c3", name: "สัตว์เลี้ยง", icon: "🐈", color: "#a855f7", kind: "expense", total: 4_830 },
    { category_id: "c4", name: "ของใช้ในบ้าน", icon: "🧻", color: "#10b981", kind: "expense", total: 3_180 },
    { category_id: "c5", name: "บันเทิง", icon: "🎬", color: "#ec4899", kind: "expense", total: 2_140 },
    { category_id: "c6", name: "สุขภาพ", icon: "💊", color: "#06b6d4", kind: "expense", total: 1_890 },
  ],
  byDay: [
    { day: "2026-08-20", income: 0, expense: 480 },
    { day: "2026-08-21", income: 0, expense: 1_240 },
    { day: "2026-08-22", income: 0, expense: 890 },
    { day: "2026-08-23", income: 0, expense: 2_310 },
    { day: "2026-08-24", income: 0, expense: 640 },
    { day: "2026-08-25", income: 62_000, expense: 1_120 },
    { day: "2026-08-26", income: 0, expense: 779 },
  ],
  byPaymentMethod: {
    cash: { income: 0, expense: 14_320 },
    transfer: { income: 62_000, expense: 21_400 },
    unspecified: { income: 0, expense: 2_100 },
  },
};

const baseTx = {
  ledger_id: "demo",
  user_id: "demo",
  payment_method: null,
  fx_currency: null,
  fx_amount: null,
  fx_rate: null,
  created_at: "2026-08-26T00:00:00Z",
  updated_at: "2026-08-26T00:00:00Z",
  deleted_at: null,
  recurring_id: null,
  skipped: false,
  trip_id: null,
  account_id: null,
  trip: null,
} as const;

const recent: TransactionWithCategory[] = [
  {
    ...baseTx,
    id: "t1",
    category_id: "c5",
    kind: "expense",
    amount: 145,
    note: "เค้กช็อกโกแลต",
    occurred_at: "2026-08-26T11:20:00Z",
    category: { id: "c5", name: "อาหาร", icon: "🍜", color: "#f97316" },
  },
  {
    ...baseTx,
    id: "t2",
    category_id: "c3",
    kind: "expense",
    amount: 545,
    note: "อาหารแมว ซาลมอน",
    occurred_at: "2026-08-26T10:05:00Z",
    category: { id: "c3", name: "สัตว์เลี้ยง", icon: "🐈", color: "#a855f7" },
  },
  {
    ...baseTx,
    id: "t3",
    category_id: "c2",
    kind: "expense",
    amount: 89,
    note: "BTS",
    occurred_at: "2026-08-26T08:30:00Z",
    category: { id: "c2", name: "เดินทาง", icon: "🚕", color: "#3b82f6" },
  },
  {
    ...baseTx,
    id: "t4",
    category_id: null,
    kind: "income",
    amount: 62_000,
    note: "เงินเดือน",
    occurred_at: "2026-08-25T02:00:00Z",
    category: null,
  },
];

const baseAccount = {
  ledger_id: "demo",
  type: "bank" as const,
  initial_balance: 0,
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
  txCount: 0,
  transferCount: 0,
};

const accounts: AccountWithBalance[] = [
  { ...baseAccount, id: "a1", name: "กสิกรไทย", icon: "🏦", color: "#10b981", currency: "THB", balance: 48_200 },
  { ...baseAccount, id: "a2", name: "เงินสด", type: "cash", icon: "💵", color: "#f97316", currency: "THB", balance: 3_450 },
  { ...baseAccount, id: "a3", name: "TrueMoney", type: "e_wallet", icon: "📱", color: "#3b82f6", currency: "THB", balance: 1_200 },
];

export default async function DashboardPreviewPage() {
  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const widgets: WidgetMap = {
    expenseByCategory: (
      <CategorySummary summary={summary} currency={currency} fmtLocale={fmtLocale} />
    ),
    dailyTrend: (
      <section className="rounded-[22px] soft-raised p-6">
        <h2 className="section-heading font-semibold mb-4">รายวัน</h2>
        <DailyTrendChart summary={summary} currency={currency} fmtLocale={fmtLocale} />
      </section>
    ),
    accountBalances: (
      <DashboardAccountBalances
        accounts={accounts}
        homeCurrency={currency}
        fmtLocale={fmtLocale}
      />
    ),
    paymentMethod: (
      <PaymentMethodBreakdown summary={summary} currency={currency} fmtLocale={fmtLocale} />
    ),
    recent: (
      <RecentTransactionsCompact
        items={recent}
        currency={currency}
        fmtLocale={fmtLocale}
        showTrip={false}
      />
    ),
  };

  return (
    <DashboardLayoutProvider>
      <div className="soft-page min-h-screen">
        <div className="max-w-md mx-auto px-4 py-6 space-y-6 fade-rise">
          <DashboardHero
            name="ชินกฤต"
            income={summary.income}
            expense={summary.expense}
            balance={summary.balance}
            budgetCap={55_000}
            currency={currency}
            fmtLocale={fmtLocale}
            monthLabel={monthLabel}
            ledgerName="ใจถัง"
            ledgerIcon="📒"
          />
          <DashboardWidgetShell widgets={widgets} />
        </div>
      </div>
    </DashboardLayoutProvider>
  );
}
