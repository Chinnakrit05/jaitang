import { auth } from "@/auth";
import { TrendingDown, TrendingUp, Wallet, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "you";

  // TODO: fetch real summary from supabase once transactions exist
  const summary = { income: 0, expense: 0, balance: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">สวัสดี {name} 👋</h1>
          <p className="text-sm text-(--muted) mt-1">
            ภาพรวมการเงินเดือนนี้
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
          tone="balance"
        />
      </div>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
        <h2 className="font-semibold mb-2">รายการล่าสุด</h2>
        <p className="text-sm text-(--muted)">
          ยังไม่มีรายการ — กด <strong>เพิ่มรายการ</strong> เพื่อเริ่มจดบันทึก
        </p>
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
        <h2 className="font-semibold mb-4">สรุปตามหมวด</h2>
        <p className="text-sm text-(--muted)">
          กราฟจะปรากฏเมื่อมีข้อมูลรายการแล้ว
        </p>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "income" | "expense" | "balance";
}) {
  const toneClass =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--accent)";

  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
      <div className="flex items-center justify-between text-sm text-(--muted) mb-2">
        <span>{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value === 0 ? "—" : new Intl.NumberFormat("th-TH").format(value)}
        {value !== 0 && <span className="text-sm ml-1 text-(--muted)">฿</span>}
      </div>
    </div>
  );
}
