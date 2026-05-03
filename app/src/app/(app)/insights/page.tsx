import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { compareMonths } from "@/lib/insights";
import { generateMonthInsightsSummary } from "@/lib/insights-ai";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { nowInBusinessTz } from "@/lib/business-tz";
import type { CategoryDelta } from "@/lib/insights";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;
  const [sp, { ledgerId, ledger }, t, locale] = await Promise.all([
    searchParams,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  const now = nowInBusinessTz();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ymRaw = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : fallback;
  const [yStr, mStr] = ymRaw.split("-");
  const year = Number(yStr);
  const month = Number(mStr);

  const compare = await compareMonths(ledgerId, year, month);

  // Run the AI step in parallel with rendering only when enabled. We
  // intentionally don't `await` for AI separately — the page already pays
  // the round-trip for `compareMonths`, and Haiku adds another ~600 ms
  // worst case, which is acceptable for a "deep" view like Insights.
  let aiSummary: string | null = null;
  let aiError: string | null = null;
  if (aiEnabled) {
    try {
      aiSummary = await generateMonthInsightsSummary(
        compare,
        locale,
        ledger.currency
      );
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const currency = ledger.currency;

  const totalsExpensePctLabel =
    compare.totals.expenseDeltaPct === null
      ? t("insights.deltaNoBaseline")
      : t("insights.deltaPct", {
          pct: Math.round(compare.totals.expenseDeltaPct),
        });
  const totalsIncomePctLabel =
    compare.totals.incomeDeltaPct === null
      ? t("insights.deltaNoBaseline")
      : t("insights.deltaPct", {
          pct: Math.round(compare.totals.incomeDeltaPct),
        });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-(--accent)" />
            {t("insights.title")}
          </h1>
          <p className="text-sm text-(--muted) mt-1">{t("insights.subtitle")}</p>
        </div>
        <Link
          href={`/insights/year/${year}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition"
        >
          <Calendar size={14} />
          {t("yearReport.cta", { year })}
        </Link>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Link
          href={`/insights?ym=${prev}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm transition"
        >
          <ChevronLeft size={14} />
          {t("calendar.prev")}
        </Link>
        <h2 className="font-semibold text-lg">{monthLabel}</h2>
        <Link
          href={`/insights?ym=${next}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm transition"
        >
          {t("calendar.next")}
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* AI summary */}
      <section className="rounded-2xl border border-(--accent)/40 bg-(--accent)/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={14} className="text-(--accent)" />
          {t("insights.aiHeading")}
        </div>
        {!aiEnabled ? (
          <p className="text-sm text-(--muted)">{t("insights.aiDisabled")}</p>
        ) : aiError ? (
          <p className="text-sm text-(--expense)">{aiError}</p>
        ) : (
          <p className="text-sm leading-relaxed">{aiSummary}</p>
        )}
      </section>

      {/* Totals comparison */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DeltaCard
          label={t("insights.expenseLabel")}
          thisAmount={compare.this.expense}
          prevAmount={compare.prev.expense}
          delta={compare.totals.expenseDelta}
          deltaPctLabel={totalsExpensePctLabel}
          tone="expense"
          currency={currency}
          fmtLocale={fmtLocale}
        />
        <DeltaCard
          label={t("insights.incomeLabel")}
          thisAmount={compare.this.income}
          prevAmount={compare.prev.income}
          delta={compare.totals.incomeDelta}
          deltaPctLabel={totalsIncomePctLabel}
          tone="income"
          currency={currency}
          fmtLocale={fmtLocale}
        />
      </section>

      {/* Top movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoverColumn
          heading={t("insights.upHeading")}
          icon={<TrendingUp size={14} className="text-(--expense)" />}
          rows={compare.expenseUp}
          tone="up"
          currency={currency}
          fmtLocale={fmtLocale}
          emptyLabel={t("insights.upEmpty")}
          newThisMonthLabel={t("insights.newThisMonth")}
        />
        <MoverColumn
          heading={t("insights.downHeading")}
          icon={<TrendingDown size={14} className="text-(--income)" />}
          rows={compare.expenseDown}
          tone="down"
          currency={currency}
          fmtLocale={fmtLocale}
          emptyLabel={t("insights.downEmpty")}
          newThisMonthLabel={t("insights.newThisMonth")}
        />
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  thisAmount,
  prevAmount,
  delta,
  deltaPctLabel,
  tone,
  currency,
  fmtLocale,
}: {
  label: string;
  thisAmount: number;
  prevAmount: number;
  delta: number;
  deltaPctLabel: string;
  tone: "income" | "expense";
  currency: string;
  fmtLocale: string;
}) {
  // For expense, "up" is bad (red). For income, "up" is good (green).
  // We flip the visual color independently of the underlying tone.
  const directionalClass =
    delta === 0
      ? "text-(--muted)"
      : tone === "expense"
      ? delta > 0
        ? "text-(--expense)"
        : "text-(--income)"
      : delta > 0
      ? "text-(--income)"
      : "text-(--expense)";
  const arrow = delta === 0 ? "" : delta > 0 ? "▲" : "▼";

  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-2">
      <div className="text-xs uppercase tracking-wide text-(--muted) font-medium">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">
        {formatCurrency(thisAmount, currency, fmtLocale)}
      </div>
      <div className={`text-sm tabular-nums ${directionalClass}`}>
        {arrow}{" "}
        {delta === 0
          ? "—"
          : `${delta > 0 ? "+" : ""}${formatCurrency(Math.abs(delta), currency, fmtLocale)}`}
        {delta !== 0 && (
          <span className="text-(--muted) ml-2">{deltaPctLabel}</span>
        )}
      </div>
      <div className="text-xs text-(--muted)">
        {prevAmount > 0
          ? `vs ${formatCurrency(prevAmount, currency, fmtLocale)}`
          : ""}
      </div>
    </div>
  );
}

function MoverColumn({
  heading,
  icon,
  rows,
  tone,
  currency,
  fmtLocale,
  emptyLabel,
  newThisMonthLabel,
}: {
  heading: string;
  icon: React.ReactNode;
  rows: CategoryDelta[];
  tone: "up" | "down";
  currency: string;
  fmtLocale: string;
  emptyLabel: string;
  newThisMonthLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-(--border) bg-(--card) p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        {icon}
        {heading}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-(--muted)">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{d.icon ?? "✨"}</span>
                <span className="truncate">{d.name}</span>
              </span>
              <span className="text-right shrink-0 tabular-nums">
                <div
                  className={
                    tone === "up" ? "text-(--expense)" : "text-(--income)"
                  }
                >
                  {tone === "up" ? "+" : ""}
                  {formatCurrency(Math.abs(d.delta), currency, fmtLocale)}
                  {tone === "down" && " ↓"}
                </div>
                <div className="text-[11px] text-(--muted)">
                  {d.prevAmount === 0
                    ? newThisMonthLabel
                    : d.deltaPct !== null
                    ? `${d.deltaPct > 0 ? "+" : ""}${Math.round(d.deltaPct)}%`
                    : ""}
                </div>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
