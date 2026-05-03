"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";

/**
 * Per-account balance chart on the account detail page. Plots the
 * account's monthly balance in its OWN currency (not converted to
 * home) — viewing a JPY wallet should show JPY values.
 *
 * `points` is the result of pulling perAccount[accountId] out of
 * buildNetWorthHistory. Empty arrays render an explicit empty state.
 */
export function AccountBalanceChart({
  points,
  currency,
  color,
}: {
  /** Each point's `value` is the balance at end of that month, in
   *  account-native currency. */
  points: { date: string; value: number }[];
  currency: string;
  /** Account color for the area fill — falls back to accent. */
  color?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);

  if (points.length === 0) {
    return (
      <p className="text-sm text-(--muted)">
        {t("accounts.chartEmpty")}
      </p>
    );
  }

  const stroke = color ?? "var(--accent)";

  const data = points.map((p) => {
    const d = new Date(p.date);
    return {
      monthLabel: new Intl.DateTimeFormat(fmtLocale, {
        month: "short",
      }).format(d),
      value: p.value,
    };
  });

  return (
    <div className="h-40 sm:h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="account-balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000
                ? `${Math.round(v / 1000)}k`
                : String(Math.round(v))
            }
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(value: unknown) => {
              const num =
                typeof value === "number"
                  ? value
                  : Array.isArray(value)
                  ? Number(value[0])
                  : Number(value ?? 0);
              return [
                formatCurrency(num, currency, fmtLocale),
                t("accounts.balanceLabel"),
              ] as [string, string];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#account-balance-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
