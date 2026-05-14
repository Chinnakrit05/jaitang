import Link from "next/link";
import { JtIcon } from "@/components/icons";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getMonthSummary, listTransactions } from "@/lib/transactions";
import { intlLocale } from "@/lib/locale-format";
import { dayKeyInTz, formatCurrency } from "@/lib/utils";
import { MonthHeatmap } from "@/components/month-heatmap";
import { businessTzMidnightUtc, nowInBusinessTz } from "@/lib/business-tz";
import type { TransactionWithCategory } from "@/lib/types";

/**
 * Calendar / heatmap view. Reuses `getMonthSummary` so the bucketing
 * is BUSINESS_TZ-aware out of the box. Navigation is plain links
 * (`?ym=YYYY-MM`) — no client state needed beyond what the URL holds.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, { ledgerId, ledger }, t, locale] = await Promise.all([
    searchParams,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  // Default to "this month" in BUSINESS_TZ so a Bangkok user opening the
  // page just past midnight doesn't accidentally land on yesterday's
  // month header.
  const now = nowInBusinessTz();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ymRaw = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : fallback;
  const [yStr, mStr] = ymRaw.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1-12

  // Fetch summary (already aggregates byDay) + the actual tx list for
  // the month so the day-detail panel can show real rows inline rather
  // than punt to /transactions.
  const monthFromIso = businessTzMidnightUtc(year, month - 1, 1).toISOString();
  const monthToIso = businessTzMidnightUtc(year, month, 1).toISOString();
  const [summary, txs] = await Promise.all([
    getMonthSummary(ledgerId, year, month),
    listTransactions({
      ledgerId,
      from: monthFromIso,
      to: monthToIso,
      limit: 5000,
    }),
  ]);

  // Group tx by day-of-month using BUSINESS_TZ keys — same bucketing
  // the heatmap uses, so a click on cell "2026-05-15" shows exactly
  // the rows we counted in that cell.
  const txByDay: Record<string, TransactionWithCategory[]> = {};
  for (const tx of txs) {
    const day = dayKeyInTz(tx.occurred_at);
    (txByDay[day] ??= []).push(tx);
  }

  // Top 3 spending days — preserving zero-spend days isn't useful here.
  const topDays = [...summary.byDay]
    .filter((d) => d.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 3);

  // Active days = days with at least one tx of either kind. Used for
  // the "spent X out of Y days" stat.
  const activeDays = summary.byDay.filter(
    (d) => d.income > 0 || d.expense > 0
  ).length;
  const daysInMonth = new Date(year, month, 0).getDate();
  // Average daily spend — over CALENDAR days, not just active days.
  // The "active days" stat is right beside it, so the user can switch
  // mental models if they want a higher per-spending-day average.
  const avgDailyExpense =
    daysInMonth > 0 ? summary.expense / daysInMonth : 0;

  // Build prev / next month link
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("calendar.subtitle")}</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Link
          href={`/calendar?ym=${prev}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm transition"
        >
          <JtIcon name="chevron-left" size={14} />
          {t("calendar.prev")}
        </Link>
        <h2 className="font-semibold text-lg">{monthLabel}</h2>
        <Link
          href={`/calendar?ym=${next}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm transition"
        >
          {t("calendar.next")}
          <JtIcon name="chevron-right" size={14} />
        </Link>
      </div>

      {/* Stats banner — at-a-glance month totals so the user doesn't
          have to open the Insights page to see the headline numbers. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile
          label={t("calendar.statIncome")}
          value={formatCurrency(summary.income, ledger.currency, fmtLocale)}
          icon={<JtIcon name="trending-up" size={14} />}
          tone="income"
          showSign
          rawValue={summary.income}
        />
        <StatTile
          label={t("calendar.statExpense")}
          value={formatCurrency(summary.expense, ledger.currency, fmtLocale)}
          icon={<JtIcon name="trending-down" size={14} />}
          tone="expense"
          showSign
          rawValue={summary.expense}
        />
        <StatTile
          label={t("calendar.statAvg")}
          value={formatCurrency(avgDailyExpense, ledger.currency, fmtLocale)}
          icon={<JtIcon name="accounts" size={14} />}
          tone="balance"
        />
        <StatTile
          label={t("calendar.statActiveDays")}
          value={t("calendar.statActiveDaysValue", {
            active: activeDays,
            total: daysInMonth,
          })}
          icon={<JtIcon name="calendar-check" size={14} />}
          tone="balance"
          isText
        />
      </div>

      <MonthHeatmap
        year={year}
        month={month}
        byDay={summary.byDay}
        txByDay={txByDay}
        currency={ledger.currency}
        fmtLocale={fmtLocale}
      />

      {/* Top 3 spending days — only render when we have any expense
          rows; new month / empty ledgers skip this entirely. */}
      {topDays.length > 0 && (
        <section className="rounded-2xl border border-(--border) bg-(--card) p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <JtIcon name="flame" size={14} className="text-(--expense)" />
            {t("calendar.topDaysHeading")}
          </h3>
          <ol className="space-y-2">
            {topDays.map((d, i) => {
              const [yy, mm, dd] = d.day.split("-").map(Number);
              const date = new Date(yy, mm - 1, dd);
              return (
                <li
                  key={d.day}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-(--muted) tabular-nums w-5 shrink-0">
                      #{i + 1}
                    </span>
                    <span className="truncate">
                      {new Intl.DateTimeFormat(fmtLocale, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }).format(date)}
                    </span>
                  </span>
                  <span className="text-(--expense) font-semibold tabular-nums">
                    −{formatCurrency(d.expense, ledger.currency, fmtLocale)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
  showSign,
  rawValue,
  isText,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "income" | "expense" | "balance";
  showSign?: boolean;
  rawValue?: number;
  isText?: boolean;
}) {
  const cls =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--foreground)";
  // For the headline tiles we want the sign to read at-a-glance: "+"
  // for income, "−" for expense, nothing for balance/text tiles. When
  // the raw is 0 we don't bother with a sign.
  const sign =
    showSign && rawValue !== undefined && rawValue > 0
      ? tone === "income"
        ? "+"
        : tone === "expense"
        ? "−"
        : ""
      : "";
  return (
    <div className="rounded-xl border border-(--border) bg-(--card) px-3 py-2.5 card-hover">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-(--muted) mb-1">
        <span className="font-medium truncate">{label}</span>
        <span className={`${cls} opacity-70`}>{icon}</span>
      </div>
      <div className={`text-base sm:text-lg font-semibold tabular-nums ${cls}`}>
        {isText ? value : `${sign}${value}`}
      </div>
    </div>
  );
}
