"use client";

import { useLocale, useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";

import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { type RecurringRule } from "@/lib/recurring";

/**
 * Stats banner at the top of /recurring:
 *   - Monthly cost rollup, bucketed per currency (we don't FX-sum
 *     across currencies — too misleading without explicit conversion).
 *   - Active rule count.
 *
 * Computes everything client-side from the already-fetched rules; no
 * extra round-trips to the server.
 */
export function SubscriptionStats({
  rules,
  homeCurrency,
}: {
  rules: RecurringRule[];
  homeCurrency: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);

  const active = rules.filter((r) => r.active);

  // Monthly cost per currency. Convert each rule's amount to a
  // monthly-equivalent factor based on its period:
  //   daily    → ×30  (calendar month rough avg)
  //   weekly   → ×4.33 (52/12)
  //   monthly  → ×1
  // Income rules are treated separately so the banner doesn't say
  // "Monthly cost: ฿0" when the user has only salary rules.
  const expenseByCurrency = new Map<string, number>();
  const incomeByCurrency = new Map<string, number>();
  for (const r of active) {
    // Variable-cost rules (amount null) can't contribute to the monthly
    // forecast — we don't know the value yet.
    if (r.amount === null) continue;
    const factor =
      r.period === "daily"
        ? 30
        : r.period === "weekly"
          ? 52 / 12
          : r.period === "yearly"
            ? 1 / 12
            : 1;
    const cur = r.fx_currency ?? homeCurrency;
    const monthly = r.amount * factor;
    if (r.kind === "expense") {
      expenseByCurrency.set(cur, (expenseByCurrency.get(cur) ?? 0) + monthly);
    } else {
      incomeByCurrency.set(cur, (incomeByCurrency.get(cur) ?? 0) + monthly);
    }
  }

  if (active.length === 0) return null;

  const expenseEntries = Array.from(expenseByCurrency.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const incomeEntries = Array.from(incomeByCurrency.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-3">
      {/* Headline stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-(--border) bg-(--card) p-4 card-hover">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-(--muted) mb-2">
            <span className="font-medium">
              {t("subscriptions.monthlyCost")}
            </span>
            <JtIcon name="layers" size={18} className="text-(--expense) opacity-70" />
          </div>
          {expenseEntries.length === 0 ? (
            <div className="text-sm text-(--muted)">
              {formatCurrency(0, homeCurrency, fmtLocale)}
            </div>
          ) : (
            <div className="space-y-0.5">
              {expenseEntries.map(([cur, sum]) => (
                <div
                  key={cur}
                  className="text-2xl font-semibold tabular-nums text-(--expense)"
                >
                  {formatCurrency(sum, cur, fmtLocale)}
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-(--muted) mt-1">
            {t("subscriptions.activeCount", { count: active.length })}
          </div>
        </div>

        {incomeEntries.length > 0 && (
          <div className="rounded-2xl border border-(--border) bg-(--card) p-4 card-hover">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-(--muted) mb-2">
              <span className="font-medium">
                {t("subscriptions.monthlyIncome")}
              </span>
              <JtIcon name="layers" size={18} className="text-(--income) opacity-70" />
            </div>
            <div className="space-y-0.5">
              {incomeEntries.map(([cur, sum]) => (
                <div
                  key={cur}
                  className="text-2xl font-semibold tabular-nums text-(--income)"
                >
                  {formatCurrency(sum, cur, fmtLocale)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
