import { DashboardHero } from "@/components/dashboard-hero";
import { CategorySummary } from "@/components/category-summary";
import { RecentTransactionsCompact } from "@/components/recent-transactions-compact";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import type { MonthSummary, TransactionWithCategory } from "@/lib/types";

/**
 * Public preview for the dashboard hero card + category summary.
 * Mirrors the pattern used by `/icon-styles-preview` — outside the
 * `(app)` auth group so designers can iterate on the visual without a
 * Supabase session. Feeds each component fixture data covering every
 * meaningful state so the eye can compare them side by side.
 */
export default function HeroPreviewPage() {
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const heroScenarios = [
    {
      title: "Over budget (เกินงบ)",
      props: {
        name: "dev",
        income: 0,
        expense: 128_568,
        balance: -128_568,
        budgetCap: 90_000,
      },
    },
    {
      title: "Worried (70–99%)",
      props: {
        name: "Fluke",
        income: 45_000,
        expense: 38_500,
        balance: 6_500,
        budgetCap: 50_000,
      },
    },
    {
      title: "Happy (<70%)",
      props: {
        name: "Pim",
        income: 60_000,
        expense: 18_200,
        balance: 41_800,
        budgetCap: 50_000,
      },
    },
    {
      title: "No budget set",
      props: {
        name: "Guest",
        income: 12_000,
        expense: 9_300,
        balance: 2_700,
        budgetCap: 0,
      },
    },
    {
      title: "Zero state",
      props: {
        name: "ใหม่",
        income: 0,
        expense: 0,
        balance: 0,
        budgetCap: 0,
      },
    },
  ];

  const categoryDominant: MonthSummary = {
    income: 0,
    expense: 128_568,
    balance: -128_568,
    byCategory: [
      { category_id: "1", name: "Bts", icon: "🚕", color: null, kind: "expense", total: 124_478 },
      { category_id: "2", name: "ของหวาน", icon: "🍰", color: null, kind: "expense", total: 3_588 },
      { category_id: "3", name: "ไม่ระบุ", icon: "✨", color: null, kind: "expense", total: 368 },
      { category_id: "4", name: "น้ำมัน", icon: "⛽", color: null, kind: "expense", total: 99 },
      { category_id: "5", name: "คาเฟ่", icon: "☕", color: null, kind: "expense", total: 35 },
    ],
    byDay: [],
    byPaymentMethod: {
      cash: { income: 0, expense: 0 },
      transfer: { income: 0, expense: 0 },
      unspecified: { income: 0, expense: 0 },
    },
  };

  const categoryEmpty: MonthSummary = {
    ...categoryDominant,
    byCategory: [],
  };

  const baseTx = {
    ledger_id: "demo",
    user_id: "demo",
    payment_method: null,
    fx_currency: null,
    fx_amount: null,
    fx_rate: null,
    created_at: "2026-05-25T00:00:00Z",
    updated_at: "2026-05-25T00:00:00Z",
    deleted_at: null,
    recurring_id: null,
    skipped: false,
  } as const;

  const recentFixtures: TransactionWithCategory[] = [
    {
      ...baseTx,
      id: "t1",
      category_id: "c1",
      trip_id: null,
      account_id: null,
      kind: "expense",
      amount: 1_233,
      note: "มะม่วง",
      occurred_at: "2026-05-25T18:12:00Z",
      category: { id: "c1", name: "ของหวาน", icon: "🍰", color: null },
      trip: null,
    },
    {
      ...baseTx,
      id: "t2",
      category_id: "c2",
      trip_id: null,
      account_id: null,
      kind: "expense",
      amount: 65,
      note: null,
      occurred_at: "2026-05-25T15:40:00Z",
      category: { id: "c2", name: "Bts", icon: "🚕", color: null },
      trip: null,
    },
    {
      ...baseTx,
      id: "t3",
      category_id: "c3",
      trip_id: "trip1",
      account_id: null,
      kind: "expense",
      amount: 4_800,
      note: "โรงแรมบางลำพู",
      occurred_at: "2026-05-25T11:20:00Z",
      category: { id: "c3", name: "ที่พัก", icon: "🏨", color: null },
      trip: { id: "trip1", name: "ทริปกรุงเทพ", icon: "✈️", color: "#A78BFA", currency: null },
    },
    {
      ...baseTx,
      id: "t4",
      category_id: null,
      trip_id: null,
      account_id: null,
      kind: "income",
      amount: 35_000,
      note: "เงินเดือน",
      occurred_at: "2026-05-25T09:00:00Z",
      category: null,
      trip: null,
    },
    {
      ...baseTx,
      id: "t5",
      category_id: "c4",
      trip_id: null,
      account_id: null,
      kind: "expense",
      amount: 85,
      note: null,
      occurred_at: "2026-05-25T07:30:00Z",
      category: { id: "c4", name: "คาเฟ่", icon: "☕", color: null },
      trip: null,
    },
  ];

  const categoryBalanced: MonthSummary = {
    income: 0,
    expense: 18_200,
    balance: 0,
    byCategory: [
      { category_id: "1", name: "อาหาร", icon: "🍜", color: null, kind: "expense", total: 6_500 },
      { category_id: "2", name: "เดินทาง", icon: "🚕", color: null, kind: "expense", total: 4_200 },
      { category_id: "3", name: "ของหวาน", icon: "🍰", color: null, kind: "expense", total: 3_300 },
      { category_id: "4", name: "ช้อปปิ้ง", icon: "🛒", color: null, kind: "expense", total: 2_500 },
      { category_id: "5", name: "คาเฟ่", icon: "☕", color: null, kind: "expense", total: 1_200 },
      { category_id: "6", name: "บันเทิง", icon: "🎮", color: null, kind: "expense", total: 500 },
    ],
    byDay: [],
    byPaymentMethod: {
      cash: { income: 0, expense: 0 },
      transfer: { income: 0, expense: 0 },
      unspecified: { income: 0, expense: 0 },
    },
  };

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/reports", label: "รายงาน", icon: "insights" },
  ];

  return (
    <div className="min-h-screen p-6 sm:p-10 space-y-10 max-w-2xl mx-auto pb-32">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard preview</h1>
        <p className="text-sm text-(--muted) mt-1">
          Visual sanity check for the redesigned hero card + category
          summary across states. Powered by fixture data — no Supabase
          needed.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-wide text-(--muted) font-bold">
          Hero card
        </h2>
        {heroScenarios.map((s) => (
          <div key={s.title} className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
              {s.title}
            </div>
            <DashboardHero
              {...s.props}
              currency="THB"
              fmtLocale="th-TH"
              monthLabel={monthLabel}
            />
          </div>
        ))}
      </section>

      <section className="space-y-6 pt-6 border-t border-(--border)">
        <h2 className="text-xs uppercase tracking-wide text-(--muted) font-bold">
          Recent transactions
        </h2>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
            Mixed list (note + uncategorized + trip chip + income)
          </div>
          <RecentTransactionsCompact
            items={recentFixtures}
            currency="THB"
            fmtLocale="th-TH"
          />
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
            Empty
          </div>
          <RecentTransactionsCompact
            items={[]}
            currency="THB"
            fmtLocale="th-TH"
          />
        </div>
      </section>

      <section className="space-y-6 pt-6 border-t border-(--border)">
        <h2 className="text-xs uppercase tracking-wide text-(--muted) font-bold">
          Category summary
        </h2>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
            One dominant category (Bts 97%) — tail collapsed into &ldquo;อื่นๆ&rdquo;
          </div>
          <CategorySummary
            summary={categoryDominant}
            currency="THB"
            fmtLocale="th-TH"
          />
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
            Balanced split (6 categories)
          </div>
          <CategorySummary
            summary={categoryBalanced}
            currency="THB"
            fmtLocale="th-TH"
          />
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
            Empty — no expenses
          </div>
          <CategorySummary
            summary={categoryEmpty}
            currency="THB"
            fmtLocale="th-TH"
          />
        </div>
      </section>

      {/* Bottom nav with center FAB — pinned to the viewport so the
          preview shows it in its real position. Phase 4 deliverable. */}
      <MobileNav
        primary={navPrimary}
        all={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );
}
