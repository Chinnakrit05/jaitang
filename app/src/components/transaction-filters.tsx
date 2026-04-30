"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Category, TxKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "month", label: "thisMonth" },
  { key: "prev", label: "lastMonth" },
  { key: "30d", label: "last30Days" },
  { key: "ytd", label: "ytd" },
  { key: "all", label: "all" },
] as const;

export function TransactionFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  const range = params.get("range") ?? "month";
  const kind = (params.get("kind") ?? "") as TxKind | "";
  const categoryId = params.get("category") ?? "";

  function update(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    startTransition(() => router.push(`/transactions${qs ? `?${qs}` : ""}`));
  }

  return (
    <div className={cn("space-y-3", pending && "opacity-60")}>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => update({ range: r.key })}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition border",
              range === r.key
                ? "bg-(--foreground) text-(--background) border-transparent"
                : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground)"
            )}
          >
            {t(`transactions.filters.${r.label}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={kind}
          onChange={(e) => update({ kind: e.target.value || null })}
          className="px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) text-sm"
        >
          <option value="">{t("transactions.filters.allKinds")}</option>
          <option value="income">📥 {t("common.income")}</option>
          <option value="expense">📤 {t("common.expense")}</option>
        </select>

        <select
          value={categoryId}
          onChange={(e) => update({ category: e.target.value || null })}
          className="px-3 py-1.5 rounded-lg border border-(--border) bg-(--card) text-sm"
        >
          <option value="">{t("transactions.filters.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name} (
              {c.kind === "income" ? t("common.incomeShort") : t("common.expenseShort")})
            </option>
          ))}
        </select>

        {(kind || categoryId) && (
          <button
            type="button"
            onClick={() => update({ kind: null, category: null })}
            className="text-(--muted) hover:text-(--foreground) underline text-xs ml-1"
          >
            {t("transactions.filters.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
