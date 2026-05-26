"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";

const PEACH = "linear-gradient(135deg, #E89A6A 0%, #D87A45 100%)";

type Row = {
  id: string;
  primary: string;
  icon: string | null;
  period: string;
  // One of: "applied" → ✓ ใส่แล้วเดือนนี้
  //         "next-date" → ครั้งถัดไป <date>
  //         "variable" → 📝 บิลรอกรอก · ครั้งถัดไป <date>
  status: "applied" | "next-date" | "variable";
  nextLabel?: string;
  amount: number | null;
  kind: "expense" | "income";
};

/**
 * Public preview for /recurring redesign. Mirrors the Figma mockup —
 * back / title / + add header, rounded card list, helper text. Wires
 * to fixture rows so designers can iterate without a session.
 */
export default function RecurringPreviewPage() {
  const t = useTranslations();
  const rows: Row[] = [
    {
      id: "1",
      primary: "ค่าเนก",
      icon: "🚕",
      period: t("recurring.frequencyMonthly"),
      status: "applied",
      amount: 123_656,
      kind: "expense",
    },
    {
      id: "2",
      primary: "ของใช้",
      icon: "🏠",
      period: t("recurring.frequencyMonthly"),
      status: "applied",
      amount: 1_233,
      kind: "expense",
    },
    {
      id: "3",
      primary: "Nj",
      icon: null,
      period: t("recurring.frequencyMonthly"),
      status: "next-date",
      nextLabel: "17 มิ.ย. 2026",
      amount: 50,
      kind: "expense",
    },
    {
      id: "4",
      primary: "50",
      icon: "☕",
      period: t("recurring.frequencyMonthly"),
      status: "variable",
      nextLabel: "17 มิ.ย. 2026",
      amount: null,
      kind: "expense",
    },
  ];

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
          <h1 className="text-base font-semibold">{t("recurring.title")}</h1>
          <button
            type="button"
            aria-label="add"
            className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm"
            style={{ background: PEACH }}
          >
            <JtIcon name="plus-fab" size={20} />
          </button>
        </div>

        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border)/60 overflow-hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "color-mix(in srgb, #F9D5B4 40%, var(--card))",
                  }}
                >
                  <EmojiOrIcon value={r.icon} fallback="recurring" size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] leading-tight truncate">
                    {r.primary}
                  </p>
                  <p className="text-[11px] text-(--muted) leading-tight mt-0.5 flex items-center gap-1 flex-wrap">
                    <span>{r.period}</span>
                    <span>·</span>
                    {r.status === "variable" && (
                      <>
                        <span>{t("recurring.variableBillBadge")}</span>
                        <span>·</span>
                      </>
                    )}
                    {r.status === "applied" ? (
                      <span className="text-(--income)">
                        {t("recurring.appliedThisPeriod")}
                      </span>
                    ) : (
                      <span>
                        {t("recurring.nextRun", { when: r.nextLabel ?? "—" })}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  className={cn(
                    "tabular-nums font-semibold shrink-0 text-[14px]",
                    r.amount === null
                      ? "text-(--muted)"
                      : r.kind === "income"
                      ? "text-(--income)"
                      : "text-(--expense)"
                  )}
                >
                  {r.amount === null ? (
                    "฿—"
                  ) : (
                    <>
                      {r.kind === "income" ? "+" : "−"}฿
                      {r.amount.toLocaleString()}
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-center text-xs text-(--muted)">
          {t("recurring.listHelper")}
        </p>
      </div>
      <MobileNav
        primary={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );
}
