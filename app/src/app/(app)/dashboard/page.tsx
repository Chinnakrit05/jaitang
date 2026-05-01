import { TrendingDown, TrendingUp, Wallet, Plus } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getMonthSummary, listTransactions } from "@/lib/transactions";
import { TransactionList } from "@/components/transaction-list";
import { ExpenseByCategoryChart, DailyTrendChart } from "@/components/dashboard-charts";
import { PaymentMethodBreakdown } from "@/components/payment-method-breakdown";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

export default async function DashboardPage() {
  const [{ ledgerId, ledger, user }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const name = user.name?.split(" ")[0] ?? "you";
  const currency = ledger.currency;

  const now = new Date();
  const [summary, recent] = await Promise.all([
    getMonthSummary(ledgerId, now.getFullYear(), now.getMonth() + 1),
    listTransactions({ ledgerId, limit: 5 }),
  ]);

  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.greeting", { name })}</h1>
          <p className="text-sm text-(--muted) mt-1">
            {t("dashboard.monthOverview", { month: monthLabel })}
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
        >
          <Plus size={18} />
          {t("dashboard.addTransaction")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label={t("dashboard.incomeMonth")}
          value={summary.income}
          icon={<TrendingUp size={20} />}
          tone="income"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <SummaryCard
          label={t("dashboard.expenseMonth")}
          value={summary.expense}
          icon={<TrendingDown size={20} />}
          tone="expense"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <SummaryCard
          label={t("dashboard.balanceCard")}
          value={summary.balance}
          icon={<Wallet size={20} />}
          tone={summary.balance >= 0 ? "balance" : "expense"}
          showSign
          currency={currency}
          fmtLocale={fmtLocale}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">{t("dashboard.expenseByCategory")}</h2>
          <ExpenseByCategoryChart summary={summary} currency={currency} fmtLocale={fmtLocale} />
        </section>

        <section className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <h2 className="font-semibold mb-4">{t("dashboard.dailyTrend")}</h2>
          <DailyTrendChart summary={summary} currency={currency} fmtLocale={fmtLocale} />
        </section>
      </div>

      <PaymentMethodBreakdown
        summary={summary}
        currency={currency}
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
    <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
      <div className="flex items-center justify-between text-sm text-(--muted) mb-2">
        <span>{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value === 0 ? "—" : `${sign}${formatCurrency(Math.abs(value), currency, fmtLocale)}`}
      </div>
    </div>
  );
}
