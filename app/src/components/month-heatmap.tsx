"use client";

import { useState } from "react";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { MonthSummary, TransactionWithCategory } from "@/lib/types";

type ByDay = MonthSummary["byDay"];

/**
 * Month heatmap. Renders a 6×7 grid (days of week × up to 6 weeks) with
 * each cell shaded by that day's expense relative to the month's max.
 *
 * Click a day → expand a panel below with the actual transactions of
 * that day, in/out totals, and an Edit link per row. We pre-fetch the
 * full month's tx list on the server (`txByDay`) so opening a day is
 * instant — no extra round-trip.
 *
 * A small green dot in the top-left of a cell signals "this day had
 * income" — useful when only the expense intensity drives the heat
 * color and you'd otherwise miss the income-only days entirely.
 */
export function MonthHeatmap({
  year,
  month, // 1-12
  byDay,
  txByDay,
  currency,
  fmtLocale,
}: {
  year: number;
  month: number;
  byDay: ByDay;
  /** Map of YYYY-MM-DD → list of transactions for that day. Optional
   *  for backwards compat with callers that only want totals. */
  txByDay?: Record<string, TransactionWithCategory[]>;
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
  const openedTxs = openDay ? txByDay?.[openDay] ?? [] : [];
  const todayBangkok = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Day-of-week headers — Mon-first so Thai users see standard order
  const dowKeys = [
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
      <div className="rounded-[22px] soft-raised p-4">
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
            const income = stats?.income ?? 0;
            const lv = level(expense);
            const isToday = c.key === todayBangkok;
            const isOpen = openDay === c.key;
            const dayTxs = txByDay?.[c.key] ?? [];
            const txCount = dayTxs.length;

            // Top category icon for this day — pick the icon of the
            // single category with the highest expense sum. Hidden on
            // low-spend days to keep the cell from looking cluttered.
            let topIcon: string | null = null;
            if (lv >= 2 && dayTxs.length > 0) {
              const byCat = new Map<string, { icon: string | null; total: number }>();
              for (const tx of dayTxs) {
                if (tx.kind !== "expense") continue;
                const id = tx.category?.id ?? "__null__";
                const cur = byCat.get(id) ?? {
                  icon: tx.category?.icon ?? null,
                  total: 0,
                };
                cur.total += tx.amount;
                byCat.set(id, cur);
              }
              const top = Array.from(byCat.values()).sort(
                (a, b) => b.total - a.total
              )[0];
              topIcon = top?.icon ?? null;
            }

            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setOpenDay(isOpen ? null : c.key)}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center text-xs transition relative px-0.5",
                  HEAT_CLASSES[lv],
                  isOpen && "ring-2 ring-(--accent)",
                  isToday && !isOpen && "ring-1 ring-(--accent)/60"
                )}
                title={
                  expense > 0 || income > 0
                    ? `${
                        income > 0
                          ? `+${formatCurrency(income, currency, fmtLocale)} `
                          : ""
                      }${
                        expense > 0
                          ? `−${formatCurrency(expense, currency, fmtLocale)}`
                          : ""
                      }${txCount > 0 ? ` (${txCount})` : ""}`.trim()
                    : undefined
                }
              >
                {/* Income marker — a small green dot top-left so days
                    with ONLY income (which the heat scale ignores)
                    don't disappear visually. */}
                {income > 0 && (
                  <span
                    className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-(--income)"
                    aria-hidden
                  />
                )}
                {/* Tx count in top-right — only when more than one,
                    otherwise the bare day-number cells stay clean. */}
                {txCount > 1 && (
                  <span className="absolute top-0.5 right-1 text-[8px] tabular-nums opacity-60 font-medium">
                    {txCount}
                  </span>
                )}
                <span className="font-medium leading-none">{c.day}</span>
                {expense > 0 && (
                  <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] leading-none font-medium opacity-90">
                    {topIcon && (
                      <EmojiOrIcon value={topIcon} size={10} />
                    )}
                    <span className="tabular-nums">
                      {compactAmount(expense)}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between gap-2 mt-3 text-[10px] text-(--muted)">
          <span className="inline-flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full bg-(--income)"
              aria-hidden
            />
            {t("calendar.legendIncome")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span>{t("calendar.legendLess")}</span>
            {[0, 1, 2, 3, 4].map((lv) => (
              <span
                key={lv}
                className={cn("h-2.5 w-2.5 rounded-sm", HEAT_CLASSES[lv as 0 | 1 | 2 | 3 | 4])}
              />
            ))}
            <span>{t("calendar.legendMore")}</span>
          </span>
        </div>
      </div>

      {/* Day detail panel */}
      {openDay && (
        <div className="rounded-[22px] soft-raised p-4 space-y-3">
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

          {/* Totals row */}
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

          {/* Inline transaction list — first 8, with a link to the
              transactions page filtered by this day if there are more. */}
          {openedTxs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
                {t("calendar.dayTxHeading", { count: openedTxs.length })}
              </div>
              <ul className="rounded-xl border border-(--border) bg-(--background) divide-y divide-(--border) overflow-hidden">
                {openedTxs.slice(0, 8).map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-(--card) transition group"
                  >
                    <span className="shrink-0 inline-flex">
                      <EmojiOrIcon
                        value={tx.category?.icon}
                        fallback="sparkle"
                        size={18}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {tx.category?.name ?? t("common.uncategorizedFull")}
                      </div>
                      <div className="text-[11px] text-(--muted) flex items-center gap-1.5 flex-wrap">
                        <span>{formatDate(tx.occurred_at, fmtLocale)}</span>
                        {tx.payment_method && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5">
                              {tx.payment_method === "cash" ? (
                                <JtIcon name="banknote" size={14} />
                              ) : (
                                <JtIcon name="landmark" size={14} />
                              )}
                            </span>
                          </>
                        )}
                        {tx.trip && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5">
                              <JtIcon name="trips" size={14} />
                              <span className="truncate">{tx.trip.name}</span>
                            </span>
                          </>
                        )}
                        {tx.note && (
                          <>
                            <span>•</span>
                            <span className="truncate">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        tx.kind === "income"
                          ? "text-(--income)"
                          : "text-(--expense)"
                      }`}
                    >
                      {tx.kind === "income" ? "+" : "−"}
                      {formatCurrency(tx.amount, currency, fmtLocale)}
                    </div>
                    <Link
                      href={`/transactions/${tx.id}/edit`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded text-(--muted) hover:text-(--foreground) hover:bg-(--background) transition"
                      aria-label={t("common.edit")}
                      title={t("common.edit")}
                    >
                      <JtIcon name="pencil" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
              {openedTxs.length > 8 && (
                <Link
                  href={`/transactions?range=all&from=${openDay}`}
                  className="inline-block text-xs text-(--accent) hover:underline mt-1"
                >
                  {t("calendar.seeMoreRows", {
                    count: openedTxs.length - 8,
                  })}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact amount for the per-cell label. The cell is tiny (~50-80px on
 * mobile) so we shorten aggressively:
 *   < 1000   → "850"
 *   < 10k    → "1.2k"
 *   < 1M     → "120k"
 *   ≥ 1M     → "1.5M"
 * No currency symbol — the user already knows it's home currency from
 * the dashboard, and the heatmap title carries the same info.
 */
function compactAmount(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 10_000) {
    // 1.2k, 9.9k — show one decimal so the user can tell ฿1.2k from ฿1.9k.
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
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
