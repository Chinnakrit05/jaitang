"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { formatCurrencyCompact } from "@/lib/utils";

type Row = { id: string; primary: string; sub?: string; amount: number };

/**
 * Public preview for /reports. Self-contained fixture rows so design
 * iteration doesn't depend on a Supabase session. Mirrors the table
 * layout (Style 2) from the Figma mockup.
 */
export default function ReportsPreviewPage() {
  const t = useTranslations();
  const currency = "THB";
  const fmtLocale = "th-TH";

  const expenseRules: Row[] = [
    { id: "r1", primary: "ค่าเช่าหอ", sub: "monthly", amount: 8500 },
    { id: "r2", primary: "Netflix",   sub: "monthly", amount: 419 },
  ];
  const expenseTxs: Row[] = [
    { id: "t1", primary: "ค่าเนก", sub: "Bts",       amount: 123_656 },
    { id: "t2", primary: "มะม่วง", sub: "ของหวาน",   amount: 1_233 },
    { id: "t3", primary: "Nj",     sub: undefined,   amount: 69 },
    { id: "t4", primary: "50",     sub: "คาเฟ่",     amount: 13 },
    { id: "t5", primary: "มะม่วง", sub: "ของหวาน",   amount: 1_233 },
    { id: "t6", primary: "ค่าเนก", sub: "Bts",       amount: 123 },
  ];

  const incomeRules: Row[] = [];
  const incomeTxs: Row[] = [];

  const totalIncome = incomeTxs.reduce((s, r) => s + r.amount, 0);
  const totalExpense =
    expenseRules.reduce((s, r) => s + r.amount, 0) +
    expenseTxs.reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/insights", label: "วิเคราะห์", icon: "insights" },
  ];

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/more"
            aria-label="back"
            className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm"
          >
            <JtIcon name="chevron-left" size={18} />
          </Link>
          <h1 className="text-base font-semibold">{t("reports.title")}</h1>
          <span className="w-10" aria-hidden />
        </div>

        {/* Month switcher */}
        <div className="rounded-2xl border border-(--border) bg-(--card) flex items-center justify-between px-3 py-2">
          <button type="button" aria-label="prev" className="h-9 w-9 rounded-full flex items-center justify-center">
            <JtIcon name="chevron-left" size={20} />
          </button>
          <span className="font-semibold tabular-nums">พฤษภาคม 2026</span>
          <button type="button" aria-label="next" className="h-9 w-9 rounded-full flex items-center justify-center">
            <JtIcon name="chevron-right" size={20} />
          </button>
        </div>

        {/* Summary */}
        <div className="rounded-2xl border border-(--border) bg-(--card) grid grid-cols-3 divide-x divide-(--border)/60">
          <SumCell
            label={t("transactions.totalIncome")}
            amount={totalIncome}
            color="income"
          />
          <SumCell
            label={t("transactions.totalExpense")}
            amount={-totalExpense}
            color="expense"
          />
          <SumCell
            label={t("reports.balance")}
            amount={balance}
            color={balance >= 0 ? "foreground" : "expense"}
          />
        </div>

        {/* Income section */}
        <ReportSection
          kind="income"
          title={t("transactions.totalIncome")}
          rules={incomeRules}
          txs={incomeTxs}
          total={totalIncome}
          totalLabel={t("reports.totalIncome")}
          emptyLabel={t("reports.empty")}
        />

        {/* Expense section */}
        <ReportSection
          kind="expense"
          title={t("transactions.totalExpense")}
          rules={expenseRules}
          txs={expenseTxs}
          total={totalExpense}
          totalLabel={t("reports.totalExpense")}
          emptyLabel={t("reports.empty")}
        />
      </div>
      <MobileNav
        primary={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );

  function SumCell({
    label,
    amount,
    color,
  }: {
    label: string;
    amount: number;
    color: "income" | "expense" | "foreground";
  }) {
    const textCls =
      color === "income"
        ? "text-(--income)"
        : color === "expense"
        ? "text-(--expense)"
        : "text-(--foreground)";
    const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
    return (
      <div className="px-2 py-3 text-center">
        <p className="text-[11px] text-(--muted) mb-0.5">{label}</p>
        <p className={`font-bold tabular-nums text-sm ${textCls}`}>
          {sign}
          {formatCurrencyCompact(Math.abs(amount), currency, fmtLocale)}
        </p>
      </div>
    );
  }
}

function ReportSection({
  kind,
  title,
  rules,
  txs,
  total,
  totalLabel,
  emptyLabel,
}: {
  kind: "income" | "expense";
  title: string;
  rules: Row[];
  txs: Row[];
  total: number;
  totalLabel: string;
  emptyLabel: string;
}) {
  const headerColor = kind === "income" ? "#16A34A" : "#DC2626";
  const isEmpty = rules.length === 0 && txs.length === 0;

  return (
    <section className="rounded-2xl border border-(--border) overflow-hidden bg-(--card)">
      <header
        className="px-4 py-2 text-white font-semibold text-sm"
        style={{ background: headerColor }}
      >
        {title}
      </header>
      {isEmpty ? (
        <p className="px-4 py-4 text-sm text-(--muted)">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-(--border)/60">
          {rules.map((r) => (
            <PreviewRow key={`r-${r.id}`} row={r} recurring />
          ))}
          {txs.map((r) => (
            <PreviewRow key={r.id} row={r} />
          ))}
        </ul>
      )}
      {!isEmpty && (
        <div
          className="px-4 py-2 flex items-center justify-between border-t border-(--border)/60"
          style={{
            background: `color-mix(in srgb, ${headerColor} 8%, var(--card))`,
          }}
        >
          <span className="text-sm font-medium">{totalLabel}</span>
          <span className="font-bold tabular-nums">
            ฿{Math.round(total).toLocaleString()}
          </span>
        </div>
      )}
    </section>
  );
}

function PreviewRow({ row, recurring }: { row: Row; recurring?: boolean }) {
  const [v, setV] = useState(String(row.amount));
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {recurring && (
        <span
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "color-mix(in srgb, #F9D5B4 50%, var(--card))",
          }}
        >
          <EmojiOrIcon value={null} fallback="recurring" size={16} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{row.primary}</p>
        {row.sub && (
          <p className="text-xs text-(--muted) truncate">{row.sub}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-0.5 tabular-nums">
        <span className="text-(--muted) text-xs">฿</span>
        <input
          type="text"
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))}
          size={Math.max(3, v.length)}
          className="bg-transparent text-right font-semibold tabular-nums focus:outline-none focus:bg-(--background) focus:px-1 focus:rounded transition"
        />
      </span>
    </li>
  );
}
