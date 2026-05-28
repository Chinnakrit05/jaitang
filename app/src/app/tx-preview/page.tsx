import { TransactionList } from "@/components/transaction-list";
import { TransactionsHeader } from "@/components/transactions-header";
import { TransactionsHero } from "@/components/transactions-hero";
import { CategoryFilterPills } from "@/components/category-filter-pills";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import type { Category, TransactionWithCategory } from "@/lib/types";

/**
 * Public preview for the redesigned `/transactions` page. Mirrors the
 * pattern used by `/hero-preview` — outside the `(app)` auth group so
 * designers can iterate without a Supabase session. Feeds fixture data
 * matching the Figma mockup so visual diffs are easy.
 */
export default function TransactionsPreviewPage() {
  const categories: Category[] = [
    {
      id: "c1",
      ledger_id: "demo",
      name: "Bts",
      icon: "🚕",
      color: null,
      kind: "expense",
      sort_order: 1,
      parent_id: null,
    },
    {
      id: "c2",
      ledger_id: "demo",
      name: "ของหวาน",
      icon: "🍰",
      color: null,
      kind: "expense",
      sort_order: 2,
      parent_id: null,
    },
    {
      id: "c3",
      ledger_id: "demo",
      name: "คาเฟ่",
      icon: "☕",
      color: null,
      kind: "expense",
      sort_order: 3,
      parent_id: null,
    },
    {
      id: "c4",
      ledger_id: "demo",
      name: "น้ำมัน",
      icon: "⛽",
      color: null,
      kind: "expense",
      sort_order: 4,
      parent_id: null,
    },
    {
      id: "c5",
      ledger_id: "demo",
      name: "อาหาร",
      icon: "🍜",
      color: null,
      kind: "expense",
      sort_order: 5,
      parent_id: null,
    },
  ];

  const baseTx = {
    ledger_id: "demo",
    user_id: "demo",
    fx_currency: null,
    fx_amount: null,
    fx_rate: null,
    created_at: "2026-05-25T00:00:00Z",
    updated_at: "2026-05-25T00:00:00Z",
    deleted_at: null,
    trip_id: null,
    account_id: null,
    trip: null,
    recurring_id: null,
    skipped: false,
  } as const;

  const items: TransactionWithCategory[] = [
    {
      ...baseTx,
      id: "t1",
      category_id: "c2",
      kind: "expense",
      amount: 1_233,
      note: "มะม่วง",
      payment_method: null,
      occurred_at: "2026-05-25T18:12:00+07:00",
      category: { id: "c2", name: "ของหวาน", icon: "🍰", color: null },
    },
    {
      ...baseTx,
      id: "t2",
      category_id: "c2",
      kind: "expense",
      amount: 1_233,
      note: "มะม่วง",
      payment_method: null,
      occurred_at: "2026-05-25T18:12:00+07:00",
      category: { id: "c2", name: "ของหวาน", icon: "🍰", color: null },
    },
    {
      ...baseTx,
      id: "t3",
      category_id: "c1",
      kind: "expense",
      amount: 123_656,
      note: "ค่าเนก",
      payment_method: null,
      occurred_at: "2026-05-25T18:12:00+07:00",
      category: { id: "c1", name: "Bts", icon: "🚕", color: null },
    },
    {
      ...baseTx,
      id: "t4",
      category_id: "c1",
      kind: "expense",
      amount: 123,
      note: "ค่าเนก",
      payment_method: null,
      occurred_at: "2026-05-25T18:12:00+07:00",
      category: { id: "c1", name: "Bts", icon: "🚕", color: null },
    },
    {
      ...baseTx,
      id: "t5",
      category_id: "c3",
      kind: "expense",
      amount: 12,
      note: "รำๆๆๆๆๆ",
      payment_method: "transfer",
      occurred_at: "2026-05-25T17:12:00+07:00",
      category: { id: "c3", name: "คาเฟ่", icon: "☕", color: null },
    },
    {
      ...baseTx,
      id: "t6",
      category_id: "c4",
      kind: "expense",
      amount: 99,
      note: "น้ำมัน",
      payment_method: "cash",
      occurred_at: "2026-05-24T00:27:00+07:00",
      category: { id: "c4", name: "น้ำมัน", icon: "⛽", color: null },
    },
    {
      ...baseTx,
      id: "t7",
      category_id: "c2",
      kind: "expense",
      amount: 1_122,
      note: "มะม่วง",
      payment_method: null,
      occurred_at: "2026-05-24T17:18:00+07:00",
      category: { id: "c2", name: "ของหวาน", icon: "🍰", color: null },
    },
  ];

  const totalIncome = items
    .filter((tx) => tx.kind === "income")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = items
    .filter((tx) => tx.kind === "expense")
    .reduce((s, tx) => s + tx.amount, 0);

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/reports", label: "รายงาน", icon: "insights" },
  ];

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <TransactionsHeader title="รายการทั้งหมด" />
        <TransactionsHero
          count={items.length}
          income={totalIncome}
          expense={totalExpense}
          currency="THB"
          fmtLocale="th-TH"
        />
        <CategoryFilterPills categories={categories} />
        <TransactionList items={items} currency="THB" />
      </div>
      <MobileNav
        primary={navPrimary}
        all={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );
}
