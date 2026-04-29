import { auth } from "@/auth";
import { TrendingDown, TrendingUp, Wallet, Plus } from "lucide-react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getMonthSummary, listTransactions } from "@/lib/transactions";
import { TransactionList } from "@/components/transaction-list";
import { ExpenseByCategoryChart, DailyTrendChart } from "@/components/dashboard-charts";
import { formatTHB } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "you";

  const { ledgerId } = await requireSession();

  const now = new Date();
  const [summary, recent] = await Promise.all([
    getMonthSummary(ledgerId, now.getFullYear(), now.getMonth() + 1),
    listTransactions({ ledgerId, limit: 5 }),
  ]);

  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">สวัสดี {name} 👋</h1>
          <p className="text-sm text-(--muted) mt-1">
            ภาพรวมการเงินเดือน{monthLabel}
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
        >
          <Plus size={18} />
          เพิ่มรายการ
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="รายรับเดือนนี้"
          value={summary.income}
          icon={<TrendingUp size={20} />}
          tone="income"
        />
        <SummaryCard
          label="รายจ่ายเดือนนี้"
          value={summary.expense}
          icon={<TrendingDown size={20} />}
          tone="expense"
        />
        <SummaryCard
          label="คงเหลือ"
          value={summary.balance}
          icon={<Wallet size={20} />}
          tone={summary.balance >= 0 ? "balance" : "expense"}
          showSign
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">รายจ่ายตามหมวด</h2>
          <ExpenseByCategoryChart summary={summary} />
        </section>

        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">รายวัน</h2>
          <DailyTrendChart summary={summary} />
        </section>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">รายการล่าสุด</h2>
          <Link
            href="/transactions"
            className="text-sm text-(--accent) hover:underline"
          >
            ดูทั้งหมด →
          </Link>
        </div>
        <TransactionList items={recent} />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  showSign,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "income" | "expense" | "balance";
  showSign?: boolean;
}) {
  const toneClass =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--accent)";

  const sign = showSign ? (value >= 0 ? "+" : "−") : "";

  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
      <div className="flex items-center justify-between text-sm text-(--muted) mb-2">
        <span>{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value === 0 ? "—" : `${sign}${formatTHB(Math.abs(value))}`}
      </div>
    </div>
  );
}
