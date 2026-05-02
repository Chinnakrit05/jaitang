import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getMonthSummary } from "@/lib/transactions";
import { intlLocale } from "@/lib/locale-format";
import { MonthHeatmap } from "@/components/month-heatmap";
import { nowInBusinessTz } from "@/lib/business-tz";

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

  const summary = await getMonthSummary(ledgerId, year, month);

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
          <ChevronLeft size={14} />
          {t("calendar.prev")}
        </Link>
        <h2 className="font-semibold text-lg">{monthLabel}</h2>
        <Link
          href={`/calendar?ym=${next}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm transition"
        >
          {t("calendar.next")}
          <ChevronRight size={14} />
        </Link>
      </div>

      <MonthHeatmap
        year={year}
        month={month}
        byDay={summary.byDay}
        currency={ledger.currency}
        fmtLocale={fmtLocale}
      />
    </div>
  );
}
