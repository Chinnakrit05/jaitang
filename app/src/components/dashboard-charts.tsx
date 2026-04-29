"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthSummary } from "@/lib/types";
import { formatTHB } from "@/lib/utils";

const FALLBACK_COLORS = [
  "#f97316",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#10b981",
  "#64748b",
  "#0ea5e9",
  "#94a3b8",
  "#f59e0b",
  "#22c55e",
];

export function ExpenseByCategoryChart({ summary }: { summary: MonthSummary }) {
  const data = summary.byCategory
    .filter((c) => c.kind === "expense")
    .map((c, i) => ({
      name: c.name,
      value: c.total,
      icon: c.icon ?? "✨",
      color: c.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-(--muted) py-12 text-center">
        ยังไม่มีรายจ่ายในช่วงนี้
      </p>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatTHB(Number(v))}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 13,
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul className="space-y-1.5 text-sm">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate">
                  {d.icon} {d.name}
                </span>
              </span>
              <span className="text-(--muted) tabular-nums shrink-0">
                {formatTHB(d.value)}
                <span className="ml-1 text-xs">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DailyTrendChart({ summary }: { summary: MonthSummary }) {
  // Fill missing days with zeros for a smoother chart
  if (summary.byDay.length === 0) {
    return (
      <p className="text-sm text-(--muted) py-12 text-center">
        ยังไม่มีข้อมูลรายวัน
      </p>
    );
  }

  const data = summary.byDay.map((d) => ({
    day: d.day.slice(8, 10), // DD only
    รายรับ: d.income,
    รายจ่าย: d.expense,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
        <YAxis stroke="var(--muted)" fontSize={12} />
        <Tooltip
          formatter={(v) => formatTHB(Number(v))}
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="รายรับ" fill="var(--income)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="รายจ่าย" fill="var(--expense)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
