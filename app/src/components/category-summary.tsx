import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Donut, type DonutSlice } from "@/components/donut";
import { EmojiOrIcon } from "@/components/icons";
import type { MonthSummary } from "@/lib/types";

/**
 * Compact category breakdown card — donut on the left, legend on the
 * right. Replaces the wider 2-up `ExpenseByCategoryChart` grid so the
 * dashboard fits more vertically on phone screens.
 *
 * Improvement over the mobile original: rows with <1% share are folded
 * into a single "อื่นๆ" bucket so the legend doesn't fill up with
 * "0% — ฿35" lines that the eye can't act on.
 */

// Category brand colors — semantic, not theme-tied, so the donut slice
// matches the legend dot whatever light/dark mode is active.
const CATEGORY_PALETTE = [
  "#FF7BAC", // pink
  "#A78BFA", // purple
  "#FBBF24", // yellow
  "#FB923C", // orange
  "#60A5FA", // blue
  "#34D399", // green
];

// Mobile uses `slice(0, 6)`. Keeping the cap at 6 here matches that
// behavior — and combined with the <1% threshold, the legend never
// exceeds 7 lines (6 named + 1 "อื่นๆ" tail).
const TOP_N = 6;
const MIN_PCT_SHOWN = 1;

function formatBaht(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export async function CategorySummary({
  summary,
  currency,
  fmtLocale,
}: {
  summary: MonthSummary;
  currency: string;
  fmtLocale: string;
}) {
  const t = await getTranslations();
  const otherLabel = t("dashboard.categoryOther");

  const expenseRows = summary.byCategory
    .filter((c) => c.kind === "expense")
    .sort((a, b) => b.total - a.total);
  const total = expenseRows.reduce((s, r) => s + r.total, 0);

  // Collapse the long tail into a single row so the legend never gets
  // longer than ~6 entries. We do this after sorting: take the first
  // TOP_N rows that meet the visibility threshold, lump everything else
  // into "อื่นๆ".
  const visible: typeof expenseRows = [];
  let otherTotal = 0;
  for (const row of expenseRows) {
    const pct = total > 0 ? (row.total / total) * 100 : 0;
    if (visible.length < TOP_N && pct >= MIN_PCT_SHOWN) {
      visible.push(row);
    } else {
      otherTotal += row.total;
    }
  }
  const rows = otherTotal > 0
    ? [
        ...visible,
        {
          category_id: "__other__",
          name: otherLabel,
          icon: null,
          color: null,
          kind: "expense" as const,
          total: otherTotal,
        },
      ]
    : visible;

  const slices: DonutSlice[] = rows.map((r, i) => ({
    value: r.total,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));

  return (
    <section className="rounded-2xl border border-(--border) bg-(--card) p-5 fade-rise fade-rise-delay-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t("dashboard.categorySummary")}</h2>
        <Link
          href="/insights"
          className="text-sm text-(--accent) hover:underline shrink-0"
        >
          {t("dashboard.insightsLink")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-(--muted) py-8 text-center">
          {t("dashboard.noExpensePrompt")}
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <Donut
              data={slices}
              size={108}
              label={t("dashboard.donutSpent")}
              centerValue={total > 0 ? formatBaht(total, currency, fmtLocale) : "—"}
            />
          </div>
          <ul className="flex-1 space-y-2 min-w-0">
            {rows.map((r, i) => {
              const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
              const rawPct = total > 0 ? (r.total / total) * 100 : 0;
              const barPct = rawPct;
              // Render anything that rounds to 0 as "<1%" — a literal
              // "0%" alongside a non-zero baht amount reads like the
              // data is broken.
              const pctLabel =
                rawPct > 0 && rawPct < 0.5
                  ? "<1%"
                  : `${Math.round(rawPct)}%`;
              return (
                <li key={r.category_id ?? `row-${i}`} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="shrink-0">
                      <EmojiOrIcon value={r.icon} fallback="sparkle" size={14} />
                    </span>
                    <span className="truncate text-sm flex-1">{r.name}</span>
                    <span className="text-xs font-semibold text-(--muted) tabular-nums shrink-0">
                      {pctLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
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
                            "--bar-target": `${barPct}%`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <span className="text-[10px] text-(--muted) tabular-nums shrink-0">
                      {formatBaht(r.total, currency, fmtLocale)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
