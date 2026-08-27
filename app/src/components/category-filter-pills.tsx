"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmojiOrIcon } from "@/components/icons";

/**
 * Horizontal scrollable category filter pills. First pill is "ทั้งหมด"
 * (cleared filter); the rest are top-level categories ordered by their
 * sort_order. Subcategories are intentionally omitted from this strip —
 * users drill in via the parent pill, then refine with the categories
 * page if needed. Replaces the dropdown-based TransactionFilters for
 * this view.
 */
export function CategoryFilterPills({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  const activeId = params.get("category") ?? "";

  function select(id: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("category", id);
    else sp.delete("category");
    const qs = sp.toString();
    startTransition(() => router.push(`/transactions${qs ? `?${qs}` : ""}`));
  }

  const tops = categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1",
        pending && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={() => select(null)}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition",
          activeId === ""
            ? "bg-(--foreground) text-(--background) shadow-sm"
            : "bg-(--card) text-(--foreground) border border-(--border) hover:border-(--muted)/40"
        )}
      >
        {t("transactions.filters.allCategoriesShort")}
      </button>
      {tops.map((c) => {
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => select(c.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition",
              active
                ? "bg-(--foreground) text-(--background) shadow-sm"
                : "bg-(--card) text-(--foreground) border border-(--border) hover:border-(--muted)/40"
            )}
          >
            <EmojiOrIcon value={c.icon} size={16} className="shrink-0" />
            <span className="truncate max-w-[120px]">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
