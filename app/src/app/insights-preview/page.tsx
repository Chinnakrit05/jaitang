"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascots";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { Donut } from "@/components/donut";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { formatCurrencyCompact } from "@/lib/utils";

const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 65%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 30%, var(--card)) 100%)";
const PEACH_STRONG = "var(--peach-strong)";
const CATEGORY_PALETTE = [
  "#FF7BAC",
  "#A78BFA",
  "#FBBF24",
  "#FB923C",
  "#60A5FA",
];

type Period = "week" | "month" | "year";

/**
 * Public preview for the redesigned /insights page. Mirrors the
 * Figma mockup with fixture rows so design iteration doesn't depend
 * on a Supabase session.
 */
export default function InsightsPreviewPage() {
  const t = useTranslations();
  const currency = "THB";
  const fmtLocale = "th-TH";
  const [period, setPeriod] = useState<Period>("month");

  const rows = [
    { id: "c1", name: "Bts",      icon: "🚕" as string | null, total: 124_478 },
    { id: "c2", name: "ของหวาน",  icon: "🍰" as string | null, total: 3_588 },
    { id: "none", name: "ไม่ระบุ", icon: null  as string | null, total: 368 },
    { id: "c4", name: "น้ำมัน",   icon: "⛽" as string | null, total: 99 },
    { id: "c5", name: "คาเฟ่",    icon: "☕" as string | null, total: 35 },
  ];
  const totalExpense = rows.reduce((s, r) => s + r.total, 0);
  const top = rows[0];
  const topPct = Math.round((top.total / totalExpense) * 100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drilldownTxs: Array<{ date: string; note: string; amount: number }> =
    selectedId === "c1"
      ? [
          { date: "25 พ.ค.", note: "ค่าเนก", amount: 123_656 },
          { date: "25 พ.ค.", note: "ค่าเนก", amount: 123 },
          { date: "24 พ.ค.", note: "ค่าเน็ต", amount: 599 },
          { date: "17 พ.ค.", note: "Bts", amount: 50 },
          { date: "17 พ.ค.", note: "Bts", amount: 50 },
        ]
      : [];
  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  const cashExpense = 408;
  const transferExpense = 112;
  const unspecifiedExpense = 128_048;
  const totalPaid = cashExpense + transferExpense + unspecifiedExpense;
  const pctOf = (v: number) => (totalPaid > 0 ? Math.round((v / totalPaid) * 100) : 0);

  const periodTitle =
    period === "week"
      ? t("insights.expenseWeek")
      : period === "year"
      ? t("insights.expenseYear")
      : t("insights.expenseMonth");

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/insights", label: "วิเคราะห์", icon: "insights" },
  ];

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("insights.title")}</h1>
          <p className="text-sm text-(--muted) mt-0.5">พฤษภาคม 2026</p>
        </div>

        <section
          className="rounded-2xl px-4 py-3 border flex items-center gap-3"
          style={{
            background: PEACH_GRADIENT,
            borderColor: "color-mix(in srgb, var(--peach-strong) 25%, transparent)",
          }}
        >
          <div className="h-14 w-14 rounded-full bg-(--card)/70 flex items-center justify-center shrink-0">
            <Mascot size={48} idPrefix="insights-mascot-pv" />
          </div>
          <p className="text-sm font-medium text-(--foreground)/85">
            {t("insights.noBaseline")}
          </p>
        </section>

        <section
          className="rounded-3xl px-5 py-5 border space-y-4"
          style={{
            background: PEACH_GRADIENT,
            borderColor: "color-mix(in srgb, var(--peach-strong) 25%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{periodTitle}</h2>
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-(--card)/70">
              {(["week", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                  style={
                    p === period
                      ? { background: "white", color: PEACH_STRONG }
                      : { color: "color-mix(in srgb, var(--peach-fg) 75%, transparent)" }
                  }
                >
                  {t(
                    p === "week"
                      ? "insights.periodWeek"
                      : p === "year"
                      ? "insights.periodYear"
                      : "insights.periodMonth"
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-(--card) px-4 py-4 flex items-center gap-4">
            <div className="shrink-0">
              <Donut
                data={rows.map((r, i) => ({
                  value: r.total,
                  color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                }))}
                size={120}
                label={t("dashboard.donutSpent")}
                centerValue={formatCurrencyCompact(totalExpense, currency, fmtLocale)}
              />
            </div>
            <ul className="flex-1 space-y-1 min-w-0">
              {rows.map((r, i) => {
                const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
                const rawPct = (r.total / totalExpense) * 100;
                const isSelected = selectedId === r.id;
                return (
                  <li key={r.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId((prev) => (prev === r.id ? null : r.id))
                      }
                      className="w-full text-left rounded-xl px-1.5 py-1 transition"
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
                        <EmojiOrIcon value={r.icon} fallback="sparkle" size={14} />
                        <span className="truncate text-[13px] flex-1">{r.name}</span>
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

          <div className="rounded-2xl bg-(--card)/70 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-(--foreground)/80">
              {t("insights.topCategory")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {top.name} · {topPct}%
            </span>
          </div>
        </section>

        {selectedRow && (
          <section className="rounded-2xl border border-(--border) bg-(--card) overflow-hidden">
            <header className="flex items-center gap-3 px-4 py-3 bg-(--background)/40">
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "color-mix(in srgb, var(--peach-soft) 50%, var(--card))" }}
              >
                <EmojiOrIcon value={selectedRow.icon} fallback="sparkle" size={18} />
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
            <ul className="divide-y divide-(--border)/60">
              {drilldownTxs.map((tx, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-(--background) tabular-nums shrink-0">
                    {tx.date}
                  </span>
                  <span className="flex-1 min-w-0 text-[14px] truncate">{tx.note}</span>
                  <span className="text-[14px] font-bold tabular-nums shrink-0">
                    {formatCurrencyCompact(tx.amount, currency, fmtLocale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              {t("dashboard.paymentMethodTitle")}
            </h2>
            <span className="text-[11px] text-(--muted)">
              {t("dashboard.paymentMethodUnspecified")}{" "}
              {formatCurrencyCompact(unspecifiedExpense, currency, fmtLocale)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PaymentCard
              icon={<JtIcon name="banknote" size={20} />}
              label={t("transactions.paymentCash")}
              amount={cashExpense}
              pct={pctOf(cashExpense)}
              currency={currency}
              fmtLocale={fmtLocale}
              ofExpenseLabel={t("insights.ofExpense")}
            />
            <PaymentCard
              icon={<JtIcon name="landmark" size={20} />}
              label={t("transactions.paymentTransfer")}
              amount={transferExpense}
              pct={pctOf(transferExpense)}
              currency={currency}
              fmtLocale={fmtLocale}
              ofExpenseLabel={t("insights.ofExpense")}
            />
          </div>
        </section>
      </div>
      <MobileNav primary={navPrimary} moreLabel="เพิ่มเติม" fabLabel="เพิ่มรายการ" />
    </div>
  );
}

function PaymentCard({
  icon,
  label,
  amount,
  pct,
  currency,
  fmtLocale,
  ofExpenseLabel,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  pct: number;
  currency: string;
  fmtLocale: string;
  ofExpenseLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) px-4 py-3">
      <div className="flex items-center gap-2 text-(--muted)">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">
        {formatCurrencyCompact(amount, currency, fmtLocale)}
      </p>
      <p className="mt-1 text-[11px] text-(--muted)">
        {pct}% {ofExpenseLabel}
      </p>
    </div>
  );
}
