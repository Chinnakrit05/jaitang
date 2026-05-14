"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { NavbarPeriod } from "@/lib/period";
import { setNavbarPeriodAction } from "@/app/(app)/period-action";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

const PERIODS: NavbarPeriod[] = ["today", "week", "month", "year"];
const ICONS: Record<NavbarPeriod, string> = {
  today: "📅",
  week: "📆",
  month: "🗓️",
  year: "🎯",
};

export function NavbarStat({
  income,
  expense,
  period,
  currency,
}: {
  income: number;
  expense: number;
  period: NavbarPeriod;
  currency: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Click outside closes
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(p: NavbarPeriod) {
    setOpen(false);
    if (p === period) return;
    startTransition(async () => {
      await setNavbarPeriodAction(p);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-(--border) bg-(--card) hover:bg-(--background) transition text-sm tabular-nums disabled:opacity-60"
        aria-label={t("navbarStat.label")}
        title={t(`navbarStat.periods.${period}`)}
      >
        <span className="text-xs hidden sm:inline">{ICONS[period]}</span>
        <span className="text-(--income) font-semibold">
          +{formatCurrency(income, currency, fmtLocale)}
        </span>
        <span className="text-(--muted) text-xs">·</span>
        <span className="text-(--expense) font-semibold">
          −{formatCurrency(expense, currency, fmtLocale)}
        </span>
        <JtIcon name="chevron-down" size={18} className="text-(--muted)" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-(--border) bg-(--card) shadow-lg z-30 py-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-(--background) transition"
            >
              <span>{ICONS[p]}</span>
              <span className="flex-1">{t(`navbarStat.periods.${p}`)}</span>
              {p === period && <JtIcon name="check" size={18} className="text-(--accent)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
