"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Category, TxKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/search-input";
import { iconNameToEmoji } from "@/components/icons";
import { sortByHierarchy } from "@/lib/categories";

type TripOption = {
  id: string;
  name: string;
  icon: string | null;
  archived: boolean;
};

const RANGES = [
  { key: "today", label: "today" },
  { key: "month", label: "thisMonth" },
  { key: "prev", label: "lastMonth" },
  { key: "30d", label: "last30Days" },
  { key: "ytd", label: "ytd" },
  { key: "all", label: "all" },
] as const;

export function TransactionFilters({
  categories,
  trips = [],
}: {
  categories: Category[];
  trips?: TripOption[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  const range = params.get("range") ?? "month";
  const kind = (params.get("kind") ?? "") as TxKind | "";
  const categoryId = params.get("category") ?? "";
  const tripFilter = params.get("trip") ?? "";

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
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => update({ range: r.key })}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition border",
              range === r.key
                ? "bg-(--foreground) text-(--background) border-transparent shadow-sm"
                : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground) hover:border-(--muted)/40"
            )}
          >
            {t(`transactions.filters.${r.label}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <SearchInput placeholder={t("transactions.filters.searchPlaceholder")} />

        <select
          value={kind}
          onChange={(e) => update({ kind: e.target.value || null })}
          className="px-3 py-1.5 rounded-[12px] soft-raised-sm text-sm"
        >
          <option value="">{t("transactions.filters.allKinds")}</option>
          <option value="income">📥 {t("common.income")}</option>
          <option value="expense">📤 {t("common.expense")}</option>
        </select>

        <select
          value={categoryId}
          onChange={(e) => update({ category: e.target.value || null })}
          className="px-3 py-1.5 rounded-[12px] soft-raised-sm text-sm"
        >
          <option value="">{t("transactions.filters.allCategories")}</option>
          {sortByHierarchy(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_id ? "  ↳ " : ""}
              {iconNameToEmoji(c.icon)} {c.name} (
              {c.kind === "income" ? t("common.incomeShort") : t("common.expenseShort")})
            </option>
          ))}
        </select>

        {trips.length > 0 && (
          <select
            value={tripFilter}
            onChange={(e) => update({ trip: e.target.value || null })}
            className="px-3 py-1.5 rounded-[12px] soft-raised-sm text-sm"
          >
            <option value="">{t("transactions.filters.allTrips")}</option>
            <option value="none">{t("transactions.filters.noTrip")}</option>
            {trips.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {(tr.icon ?? "✈️") + " " + tr.name}
                {tr.archived ? " ·archived" : ""}
              </option>
            ))}
          </select>
        )}

        {(kind || categoryId || tripFilter || params.get("q")) && (
          <button
            type="button"
            onClick={() =>
              update({ kind: null, category: null, trip: null, q: null })
            }
            className="text-(--muted) hover:text-(--foreground) underline text-xs ml-1"
          >
            {t("transactions.filters.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
