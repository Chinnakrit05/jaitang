"use client";

import { useState, useTransition } from "react";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { Category } from "@/lib/types";
import type { Budget } from "@/lib/budgets";
import { setBudgetAction } from "@/app/(app)/budgets/actions";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

export function BudgetRow({
  category,
  budget,
  spent,
  currency = "THB",
}: {
  category: Category;
  budget: Budget | undefined;
  spent: number;
  currency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(budget ? String(budget.amount) : "");

  const amount = budget?.amount ?? 0;
  const pct = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
  const over = amount > 0 && spent > amount;
  const near = amount > 0 && pct >= 80 && !over;

  function save() {
    const fd = new FormData();
    fd.set("categoryId", category.id);
    fd.set("amount", draft || "0");
    startTransition(async () => {
      await setBudgetAction(fd);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3 hover:bg-(--background) transition">
      <div className="flex items-center gap-3">
        <EmojiOrIcon value={category.icon} fallback="sparkle" size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium truncate">{category.name}</div>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="0"
                  min={0}
                  step="100"
                  className="w-24 px-2 py-1 rounded-lg border border-(--border) bg-(--background) text-sm tabular-nums"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  className="p-1.5 rounded-lg text-(--income) hover:bg-(--income)/10"
                  aria-label="บันทึก"
                >
                  <JtIcon name="check" size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(budget ? String(budget.amount) : "");
                  }}
                  className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card)"
                  aria-label="ยกเลิก"
                >
                  <JtIcon name="x" size={20} />
                </button>
              </div>
            ) : amount > 0 ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm tabular-nums text-(--muted) hover:text-(--foreground) flex items-center gap-1"
              >
                {formatCurrency(spent, currency, fmtLocale)} /{" "}
                {formatCurrency(amount, currency, fmtLocale)}
                <JtIcon name="pencil" size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-(--accent) hover:underline"
              >
                {t("budgets.setBudget")}
              </button>
            )}
          </div>

          {amount > 0 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-(--border) overflow-hidden">
                <div
                  className="h-full transition-all rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: over
                      ? "var(--expense)"
                      : near
                      ? "#f59e0b"
                      : "var(--income)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span
                  className={
                    over
                      ? "text-(--expense) font-medium"
                      : near
                      ? "text-amber-500 font-medium"
                      : "text-(--muted)"
                  }
                >
                  {over
                    ? t("budgets.overBudget", {
                        amount: formatCurrency(spent - amount, currency, fmtLocale),
                      })
                    : near
                    ? t("budgets.nearBudget", { pct })
                    : `${pct}%`}
                </span>
                <span className="text-(--muted)">
                  {t("budgets.remaining", {
                    amount: formatCurrency(Math.max(0, amount - spent), currency, fmtLocale),
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
