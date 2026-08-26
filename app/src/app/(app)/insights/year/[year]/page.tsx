import Link from "next/link";
import { JtIcon, iconNameToEmoji } from "@/components/icons";
import { notFound } from "next/navigation";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { buildYearReport, type YearReport } from "@/lib/year-report";
import { generateYearCommentary } from "@/lib/year-report-ai";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export default async function YearReportPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const [{ year: yearStr }, { ledgerId, ledger }, t, locale] = await Promise.all([
    params,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);

  const year = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 3000) notFound();

  const fmtLocale = intlLocale(locale);
  const report = await buildYearReport(ledgerId, year);

  // AI commentary is best-effort. Catch errors silently — empty string
  // means we render a deterministic fallback inline.
  let commentary = "";
  if (!report.empty) {
    try {
      commentary = await generateYearCommentary(report, locale, ledger.currency);
    } catch {
      commentary = "";
    }
  }

  // Max monthly value for chart scaling. We chart income + expense per
  // month side-by-side so the user can see both directions at once.
  const maxMonth = Math.max(
    1,
    ...report.monthly.flatMap((m) => [m.income, m.expense])
  );

  // Year-over-year delta (only when priorYear non-null).
  const yoyExpense = report.priorYear
    ? deltaPct(report.priorYear.totalExpense, report.totalExpense)
    : null;
  const yoyIncome = report.priorYear
    ? deltaPct(report.priorYear.totalIncome, report.totalIncome)
    : null;

  return (
    <div className="space-y-6 max-w-3xl print:max-w-full print:space-y-4">
      {/* Top bar — hidden on print to declutter the page. */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
        >
          <JtIcon name="arrow-left" size={20} />
          {t("yearReport.backToInsights")}
        </Link>
        <PrintButton label={t("yearReport.exportPdf")} />
      </div>

      <div className="rounded-[22px] soft-raised p-6 print:border-0 print:p-0 print:bg-transparent">
        <div className="flex items-center gap-3 mb-3">
          <JtIcon name="calendar" size={24} className="text-(--accent) print:hidden" />
          <h1 className="text-3xl font-bold tracking-tight">
            {t("yearReport.title", { year })}
          </h1>
        </div>
        <p className="text-sm text-(--muted)">
          {t("yearReport.subtitle", { ledger: ledger.name })}
        </p>

        {report.empty ? (
          <p className="mt-6 text-sm text-(--muted)">
            {t("yearReport.empty", { year })}
          </p>
        ) : (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <Stat
                label={t("yearReport.income")}
                value={report.totalIncome}
                tone="income"
                currency={ledger.currency}
                fmtLocale={fmtLocale}
                deltaPct={yoyIncome}
              />
              <Stat
                label={t("yearReport.expense")}
                value={report.totalExpense}
                tone="expense"
                currency={ledger.currency}
                fmtLocale={fmtLocale}
                deltaPct={yoyExpense}
                deltaInverted
              />
              <Stat
                label={t("yearReport.net")}
                value={report.net}
                tone={report.net >= 0 ? "income" : "expense"}
                signed
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
              <Stat
                label={t("yearReport.txCount")}
                value={report.txCount}
                tone="balance"
                currency={ledger.currency}
                fmtLocale={fmtLocale}
                isCount
              />
            </div>
          </>
        )}
      </div>

      {!report.empty && (
        <>
          {/* Monthly bar chart */}
          <section className="rounded-[22px] soft-raised p-6 print:border print:bg-transparent">
            <h2 className="font-semibold mb-4">
              {t("yearReport.monthlyHeading")}
            </h2>
            <MonthlyBars
              monthly={report.monthly}
              maxValue={maxMonth}
              currency={ledger.currency}
              fmtLocale={fmtLocale}
              monthFmt={fmtLocale}
              t={(key) => t(key)}
            />
          </section>

          {/* Top categories */}
          <section className="rounded-[22px] soft-raised p-6 print:border print:bg-transparent">
            <h2 className="font-semibold mb-3">
              {t("yearReport.topCategoriesHeading")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CategoryList
                title={t("yearReport.topExpense")}
                categories={report.topExpenseCategories}
                total={report.totalExpense}
                tone="expense"
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
              <CategoryList
                title={t("yearReport.topIncome")}
                categories={report.topIncomeCategories}
                total={report.totalIncome}
                tone="income"
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            </div>
          </section>

          {/* Biggest tx */}
          {(report.biggestExpense || report.biggestIncome) && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.biggestExpense && (
                <BiggestCard
                  label={t("yearReport.biggestExpense")}
                  tx={report.biggestExpense}
                  tone="expense"
                  currency={ledger.currency}
                  fmtLocale={fmtLocale}
                />
              )}
              {report.biggestIncome && (
                <BiggestCard
                  label={t("yearReport.biggestIncome")}
                  tx={report.biggestIncome}
                  tone="income"
                  currency={ledger.currency}
                  fmtLocale={fmtLocale}
                />
              )}
            </section>
          )}

          {/* AI commentary */}
          <section className="rounded-2xl border border-(--accent)/20 bg-(--accent)/5 p-6 print:border print:bg-transparent">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <JtIcon name="sparkles" size={20} className="text-(--accent)" />
              {t("yearReport.aiHeading")}
            </h2>
            {commentary ? (
              <div className="space-y-3 text-sm leading-relaxed">
                {commentary
                  .split(/\n\s*\n/)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-(--muted)">
                {t("yearReport.aiUnavailable")}
              </p>
            )}
          </section>
        </>
      )}

      <div className="text-xs text-(--muted) print:text-center">
        {t("yearReport.footer", {
          generatedAt: formatDate(new Date(), fmtLocale),
        })}
      </div>
    </div>
  );
}

function deltaPct(prev: number, curr: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function Stat({
  label,
  value,
  tone,
  signed,
  isCount,
  currency,
  fmtLocale,
  deltaPct: pct,
  deltaInverted,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "balance";
  signed?: boolean;
  isCount?: boolean;
  currency: string;
  fmtLocale: string;
  deltaPct?: number | null;
  /** When true, a positive delta is "worse" (more spending) so we
   *  flip the green/red color. */
  deltaInverted?: boolean;
}) {
  const cls =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--accent)";
  const prefix = signed ? (value >= 0 ? "+" : "−") : "";
  const display = signed ? Math.abs(value) : value;

  let pctColor = "text-(--muted)";
  if (typeof pct === "number") {
    const isPositive = pct > 0;
    if (deltaInverted) {
      pctColor = isPositive ? "text-(--expense)" : "text-(--income)";
    } else {
      pctColor = isPositive ? "text-(--income)" : "text-(--expense)";
    }
  }

  return (
    <div className="rounded-xl border border-(--border) bg-(--background) px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${cls}`}>
        {isCount
          ? display.toLocaleString(fmtLocale)
          : `${prefix}${formatCurrency(display, currency, fmtLocale)}`}
      </div>
      {typeof pct === "number" && (
        <div className={`text-[11px] tabular-nums ${pctColor}`}>
          {pct > 0 ? "+" : ""}
          {pct}% YoY
        </div>
      )}
    </div>
  );
}

function MonthlyBars({
  monthly,
  maxValue,
  currency,
  fmtLocale,
  monthFmt,
}: {
  monthly: { monthKey: string; income: number; expense: number }[];
  maxValue: number;
  currency: string;
  fmtLocale: string;
  monthFmt: string;
  t: (key: string) => string;
}) {
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return new Intl.DateTimeFormat(monthFmt, { month: "short" }).format(d);
  };

  return (
    <div className="space-y-2">
      {monthly.map((m) => (
        <div key={m.monthKey}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium w-12">{monthLabel(m.monthKey)}</span>
            <span className="tabular-nums text-(--muted)">
              {m.income > 0 && (
                <span className="text-(--income) mr-2">
                  +{formatCurrency(m.income, currency, fmtLocale)}
                </span>
              )}
              {m.expense > 0 && (
                <span className="text-(--expense)">
                  −{formatCurrency(m.expense, currency, fmtLocale)}
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-0.5 h-3">
            <div className="flex-1 bg-(--background) rounded-l overflow-hidden">
              <div
                className="h-full bg-(--income) ml-auto"
                style={{ width: `${(m.income / maxValue) * 100}%` }}
              />
            </div>
            <div className="flex-1 bg-(--background) rounded-r overflow-hidden">
              <div
                className="h-full bg-(--expense)"
                style={{ width: `${(m.expense / maxValue) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryList({
  title,
  categories,
  total,
  tone,
  currency,
  fmtLocale,
}: {
  title: string;
  categories: YearReport["topExpenseCategories"];
  total: number;
  tone: "income" | "expense";
  currency: string;
  fmtLocale: string;
}) {
  const cls = tone === "income" ? "bg-(--income)" : "bg-(--expense)";
  const textCls = tone === "income" ? "text-(--income)" : "text-(--expense)";
  if (categories.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs text-(--muted)">—</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1.5">
        {categories.map((c) => {
          const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
          return (
            <div key={`${c.category_id}-${c.name}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">
                  {c.icon ? `${iconNameToEmoji(c.icon)} ` : ""}
                  {c.name || "—"}
                </span>
                <span className={`tabular-nums font-medium ${textCls}`}>
                  {formatCurrency(c.total, currency, fmtLocale)}{" "}
                  <span className="text-(--muted)">({pct}%)</span>
                </span>
              </div>
              <div className="h-1 bg-(--background) rounded-full overflow-hidden mt-0.5">
                <div
                  className={`h-full ${cls}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BiggestCard({
  label,
  tx,
  tone,
  currency,
  fmtLocale,
}: {
  label: string;
  tx: { amount: number; note: string | null; category: { name: string; icon: string | null } | null; occurred_at: string };
  tone: "income" | "expense";
  currency: string;
  fmtLocale: string;
}) {
  const cls = tone === "income" ? "text-(--income)" : "text-(--expense)";
  return (
    <div className="rounded-[22px] soft-raised p-4 print:border">
      <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>
        {tone === "expense" ? "−" : "+"}
        {formatCurrency(tx.amount, currency, fmtLocale)}
      </div>
      <div className="text-xs text-(--muted) mt-1">
        {tx.category ? `${tx.category.icon ?? ""} ${tx.category.name}` : "—"}
        {" • "}
        {formatDate(tx.occurred_at, fmtLocale)}
      </div>
      {tx.note && (
        <div className="text-sm mt-1.5 truncate">&ldquo;{tx.note}&rdquo;</div>
      )}
    </div>
  );
}
