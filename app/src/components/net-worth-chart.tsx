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
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import type { NetWorthPoint } from "@/lib/net-worth";

/**
 * Net worth chart with headline + month-over-month delta. Foreign
 * accounts are converted using current FX rates by the lib — for
 * personal-finance trend tracking that's good enough; we don't try to
 * do historical rates (free APIs don't expose them).
 *
 * Empty/single-point cases are handled gracefully — most users have
 * less than a year of data when they first land here.
 */
export function NetWorthChart({
  points,
  homeCurrency,
}: {
  points: NetWorthPoint[];
  homeCurrency: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);

  if (points.length === 0) {
    return (
      <p className="text-sm text-(--muted)">{t("netWorth.empty")}</p>
    );
  }

  const latest = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? latest.netWorth - prev.netWorth : null;
  const deltaPct =
    prev && prev.netWorth !== 0
      ? Math.round(((latest.netWorth - prev.netWorth) / Math.abs(prev.netWorth)) * 100)
      : null;

  const trend =
    delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const trendCls =
    trend === "up"
      ? "text-(--income)"
      : trend === "down"
      ? "text-(--expense)"
      : "text-(--muted)";

  // Format month labels (Jan, Feb…) for the X-axis using the locale.
  const data = points.map((p) => {
    const d = new Date(p.date);
    return {
      monthLabel: new Intl.DateTimeFormat(fmtLocale, {
        month: "short",
      }).format(d),
      net: p.netWorth,
    };
  });

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
            {t("netWorth.headlineLabel")}
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {formatCurrency(latest.netWorth, homeCurrency, fmtLocale)}
          </div>
        </div>
        {trend !== null && delta !== null && (
          <div
            className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${trendCls}`}
          >
            {trend === "up" ? (
              <TrendingUp size={14} />
            ) : trend === "down" ? (
              <TrendingDown size={14} />
            ) : (
              <Minus size={14} />
            )}
            <span>
              {trend === "down" ? "−" : trend === "up" ? "+" : ""}
              {formatCurrency(Math.abs(delta), homeCurrency, fmtLocale)}
            </span>
            {deltaPct !== null && (
              <span className="text-(--muted)/80">
                ({deltaPct > 0 ? "+" : ""}
                {deltaPct}%)
              </span>
            )}
            <span className="text-(--muted) hidden sm:inline">
              {t("netWorth.vsPrevMonth")}
            </span>
          </div>
        )}
      </div>

      <div className="h-40 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="net-worth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--accent)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--accent)"
                  stopOpacity={0.04}
                />
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
                  formatCurrency(num, homeCurrency, fmtLocale),
                  t("netWorth.headlineLabel"),
                ] as [string, string];
              }}
            />
            <Area
              type="monotone"
              dataKey="net"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#net-worth-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
