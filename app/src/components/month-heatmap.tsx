"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn, formatCurrency } from "@/lib/utils";
import type { MonthSummary } from "@/lib/types";

type ByDay = MonthSummary["byDay"];

/**
 * Month heatmap. Renders a 6×7 grid (days of week × up to 6 weeks) with
 * each cell shaded by that day's expense relative to the month's max.
 *
 * Click a day → expand a panel below with the actual amounts. The panel
 * shows in/out totals and a hint to view the full transactions list,
 * but doesn't fetch the rows itself (we'd need another round-trip and
 * the list page already exists for that).
 */
export function MonthHeatmap({
  year,
  month, // 1-12
  byDay,
  currency,
  fmtLocale,
}: {
  year: number;
  month: number;
  byDay: ByDay;
  currency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();
  // Map day-of-month → totals for O(1) lookup
  const byKey = new Map<string, { income: number; expense: number }>();
  for (const d of byDay) byKey.set(d.day, d);

  const daysInMonth = new Date(year, month, 0).getDate();
  // JavaScript week starts on Sunday (0) — we want grid headers Mon..Sun
  // to feel more like a Thai calendar; tweak the offset.
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
  const leadingBlanks = (firstWeekday + 6) % 7; // Monday-first → 0=Mon

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key: ymd });
  }
  // Pad to a multiple of 7 for clean grid
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `pad-end-${cells.length}` });

  // Heat scale: bucket expenses into 5 levels by max-of-month. Pure 0 stays
  // neutral so empty days are visually distinct from "low spend" days.
  const maxExpense = Math.max(0, ...byDay.map((d) => d.expense));
  function level(expense: number): 0 | 1 | 2 | 3 | 4 {
    if (expense <= 0 || maxExpense <= 0) return 0;
    const ratio = expense / maxExpense;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  const [openDay, setOpenDay] = useState<string | null>(null);
  const opened = openDay ? byKey.get(openDay) : null;
  const todayBangkok = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Day-of-week headers — Mon-first so Thai users see standard order
  const dowKeys: Array<keyof ReturnType<typeof useTranslations> extends never
    ? never
    : "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-(--border) bg-(--card) p-4">
        {/* Header row: days of week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-(--muted) font-medium mb-2">
          {dowKeys.map((d) => (
            <div key={d}>{t(`calendar.dow.${d}`)}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            if (c.day === null) {
              return <div key={c.key} className="aspect-square" />;
            }
            const stats = byKey.get(c.key);
            const expense = stats?.expense ?? 0;
            const lv = level(expense);
            const isToday = c.key === todayBangkok;
            const isOpen = openDay === c.key;

            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setOpenDay(isOpen ? null : c.key)}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center text-xs transition relative",
                  HEAT_CLASSES[lv],
                  isOpen && "ring-2 ring-(--accent)",
                  isToday && !isOpen && "ring-1 ring-(--accent)/60"
                )}
                title={
                  expense > 0
                    ? formatCurrency(expense, currency, fmtLocale)
                    : undefined
                }
              >
                <span className="font-medium">{c.day}</span>
                {expense > 0 && lv >= 3 && (
                  <span className="text-[9px] font-medium opacity-80 tabular-nums">
                    {Math.round(expense / 1000)}k
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-(--muted)">
          <span>{t("calendar.legendLess")}</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span
              key={lv}
              className={cn("h-2.5 w-2.5 rounded-sm", HEAT_CLASSES[lv as 0 | 1 | 2 | 3 | 4])}
            />
          ))}
          <span>{t("calendar.legendMore")}</span>
        </div>
      </div>

      {/* Day detail panel */}
      {openDay && (
        <div className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {new Intl.DateTimeFormat(fmtLocale, {
                day: "numeric",
                month: "long",
                year: "numeric",
                weekday: "long",
              }).format(
                (() => {
                  const [y, m, d] = openDay.split("-").map(Number);
                  return new Date(y, m - 1, d);
                })()
              )}
            </h3>
            <button
              type="button"
              onClick={() => setOpenDay(null)}
              className="text-xs text-(--muted) hover:text-(--foreground)"
            >
              {t("common.close")}
            </button>
          </div>
          {!opened || (opened.income === 0 && opened.expense === 0) ? (
            <p className="text-sm text-(--muted)">{t("calendar.dayEmpty")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-(--border) bg-(--background) px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-(--muted)">
                  {t("transactions.totalIncome")}
                </div>
                <div className="text-(--income) font-semibold tabular-nums">
                  {opened.income > 0
                    ? `+${formatCurrency(opened.income, currency, fmtLocale)}`
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-(--border) bg-(--background) px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-(--muted)">
                  {t("transactions.totalExpense")}
                </div>
                <div className="text-(--expense) font-semibold tabular-nums">
                  {opened.expense > 0
                    ? `−${formatCurrency(opened.expense, currency, fmtLocale)}`
                    : "—"}
                </div>
              </div>
            </div>
          )}
          <a
            href={`/transactions?range=all&q=&from=${openDay}`}
            className="inline-block text-xs text-(--accent) hover:underline mt-1"
          >
            {t("calendar.seeRows")} →
          </a>
        </div>
      )}
    </div>
  );
}

// Tailwind-class lookup keyed by heat level. Kept inline (vs computed) so
// Tailwind's JIT picks them up without dynamic-class purging issues.
const HEAT_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-(--background) text-(--muted) border border-(--border)",
  1: "bg-(--expense)/10 text-(--foreground) border border-(--expense)/20",
  2: "bg-(--expense)/25 text-(--foreground) border border-(--expense)/30",
  3: "bg-(--expense)/45 text-white border border-(--expense)/50",
  4: "bg-(--expense)/70 text-white border border-(--expense)/80",
};
