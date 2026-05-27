"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Donut } from "@/components/donut";
import { EmojiOrIcon, JtIcon } from "@/components/icons";
import { formatCurrencyCompact, cn } from "@/lib/utils";
import type { TransactionWithCategory } from "@/lib/types";

const CATEGORY_PALETTE = [
  "#FF7BAC",
  "#A78BFA",
  "#FBBF24",
  "#FB923C",
  "#60A5FA",
];

type Row = {
  category_id: string | null;
  name: string;
  icon: string | null;
  total: number;
};

type Period = "week" | "month" | "year";

/**
 * Peach expense card + drill-down list. Top half is the donut + per-
 * category breakdown (was previously a server component); tapping a
 * row toggles a drill-down card below that lists the row's
 * transactions. The user can dismiss with the × button or by tapping
 * the same row again.
 *
 * Owns the period toggle as well — drives `?p=` so the parent server
 * page re-fetches with the new range bound.
 */
export function ExpenseBreakdownCard({
  rows,
  txs,
  currency,
  fmtLocale,
  period,
  periodLabels,
  periodTitle,
  topCategoryLabel,
  noExpenseLabel,
  donutLabel,
}: {
  rows: Row[];
  /** Already filtered to `kind === 'expense'` and inside the active
   *  period — we filter further by selected category client-side. */
  txs: TransactionWithCategory[];
  currency: string;
  fmtLocale: string;
  period: Period;
  periodLabels: Record<Period, string>;
  periodTitle: string;
  topCategoryLabel: string;
  noExpenseLabel: string;
  donutLabel: string;
}) {
  const t = useTranslations();
  const [selectedId, setSelectedId] = useState<string | "none" | null>(null);

  const totalExpense = rows.reduce((s, r) => s + r.total, 0);
  const top = rows[0];
  const topPct =
    top && totalExpense > 0 ? Math.round((top.total / totalExpense) * 100) : 0;

  const drilldownTxs = useMemo(() => {
    if (selectedId === null) return [];
    if (selectedId === "none") {
      return txs.filter((tx) => tx.category_id === null);
    }
    return txs.filter((tx) => tx.category_id === selectedId);
  }, [txs, selectedId]);

  const selectedRow =
    selectedId === null
      ? null
      : rows.find(
          (r) =>
            (r.category_id ?? "none") === (selectedId === "none" ? "none" : selectedId)
        ) ?? null;

  function toggle(id: string | null) {
    const key = id ?? "none";
    setSelectedId((prev) => (prev === key ? null : key));
  }

  return (
    <>
      <section
        className="rounded-3xl px-5 py-5 border space-y-4"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 65%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 30%, var(--card)) 100%)",
          borderColor: "color-mix(in srgb, var(--peach-strong) 25%, transparent)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{periodTitle}</h2>
          <div className="flex items-center gap-1 p-0.5 rounded-full bg-(--card)/70">
            {(["week", "month", "year"] as Period[]).map((p) => (
              <PeriodLink
                key={p}
                p={p}
                active={p === period}
                label={periodLabels[p]}
              />
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-(--card) px-4 py-6 text-center text-sm text-(--muted)">
            {noExpenseLabel}
          </div>
        ) : (
          <div className="rounded-2xl bg-(--card) px-4 py-4 flex items-center gap-4">
            <div className="shrink-0">
              <Donut
                data={rows.slice(0, 6).map((r, i) => ({
                  value: r.total,
                  color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                }))}
                size={120}
                label={donutLabel}
                centerValue={
                  totalExpense > 0
                    ? formatCurrencyCompact(totalExpense, currency, fmtLocale)
                    : "—"
                }
              />
            </div>
            <ul className="flex-1 space-y-1 min-w-0">
              {rows.slice(0, 5).map((r, i) => {
                const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
                const rawPct =
                  totalExpense > 0 ? (r.total / totalExpense) * 100 : 0;
                const key = r.category_id ?? "none";
                const isSelected = selectedId === key;
                return (
                  <li key={`row-${i}`} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => toggle(r.category_id)}
                      className={cn(
                        "w-full text-left rounded-xl px-1.5 py-1 transition",
                        isSelected && "bg-(--accent)/10 ring-1 ring-(--accent)/30"
                      )}
                      style={
                        isSelected
                          ? {
                              background: `color-mix(in srgb, ${color} 18%, transparent)`,
                              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 50%, transparent)`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <EmojiOrIcon
                          value={r.icon}
                          fallback="sparkle"
                          size={14}
                        />
                        <span className="truncate text-[13px] flex-1">
                          {r.name}
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums shrink-0">
                          {Math.round(rawPct)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-5">
                        <div
                          className="h-1 rounded-full flex-1 overflow-hidden"
                          style={{
                            background:
                              "color-mix(in srgb, var(--foreground) 6%, transparent)",
                          }}
                        >
                          <div
                            className="h-full rounded-full bar-fill"
                            style={
                              {
                                background: color,
                                "--bar-target": `${rawPct}%`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="text-[10px] text-(--muted) tabular-nums shrink-0">
                          {formatCurrencyCompact(r.total, currency, fmtLocale)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {top && (
          <div className="rounded-2xl bg-(--card)/70 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-(--foreground)/80">
              {topCategoryLabel}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {top.name} · {topPct}%
            </span>
          </div>
        )}
      </section>

      {selectedRow && (
        <section className="rounded-2xl border border-(--border) bg-(--card) overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-3 bg-(--background)/40">
            <span
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "color-mix(in srgb, var(--peach-soft) 50%, var(--card))",
              }}
              aria-hidden
            >
              <EmojiOrIcon
                value={selectedRow.icon}
                fallback="sparkle"
                size={18}
              />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{selectedRow.name}</p>
              <p className="text-[11px] text-(--muted)">
                {t("insights.txCount", { count: drilldownTxs.length })} ·{" "}
                {formatCurrencyCompact(selectedRow.total, currency, fmtLocale)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="close"
              className="h-8 w-8 rounded-full flex items-center justify-center text-(--muted) hover:bg-(--background) transition"
            >
              <JtIcon name="x" size={16} />
            </button>
          </header>
          {drilldownTxs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-(--muted)">
              {noExpenseLabel}
            </p>
          ) : (
            <ul className="divide-y divide-(--border)/60">
              {drilldownTxs.map((tx) => (
                <li key={tx.id}>
                  <Link
                    href={`/transactions/${tx.id}/edit`}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-(--background)/50 transition"
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-(--background) tabular-nums shrink-0">
                      {new Intl.DateTimeFormat(fmtLocale, {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(tx.occurred_at))}
                    </span>
                    <span className="flex-1 min-w-0 text-[14px] truncate">
                      {tx.note?.trim() || selectedRow.name}
                    </span>
                    <span className="text-[14px] font-bold tabular-nums shrink-0">
                      {formatCurrencyCompact(tx.amount, currency, fmtLocale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function PeriodLink({
  p,
  active,
  label,
}: {
  p: Period;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={p === "month" ? "/insights" : `/insights?p=${p}`}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
      style={
        active
          ? { background: "white", color: "var(--peach-strong)" }
          : { color: "color-mix(in srgb, var(--peach-fg) 75%, transparent)" }
      }
    >
      {label}
    </Link>
  );
}
