"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { RangeKey } from "@/lib/date-range";

/**
 * Pill-style range picker for the home dashboard. Mirrors the transactions
 * page's filter strip but is its own component because the dashboard has
 * fewer knobs (no kind / category dropdowns) and a different default range.
 *
 * Selection lives in the URL (`?range=`) so deep-linking + browser-back
 * work as expected.
 */
const RANGES: ReadonlyArray<{ key: RangeKey; label: string }> = [
  { key: "today", label: "today" },
  { key: "yesterday", label: "yesterday" },
  { key: "day_before", label: "day_before" },
  { key: "month", label: "thisMonth" },
  { key: "prev", label: "lastMonth" },
  { key: "30d", label: "last30Days" },
  { key: "ytd", label: "ytd" },
  { key: "all", label: "all" },
];

export function DashboardRangeFilter({ activeKey }: { activeKey: RangeKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  function setRange(key: RangeKey) {
    const sp = new URLSearchParams(params.toString());
    // Always set ?range explicitly — the page's default is "today", not
    // "month", so stripping the param sent the user back to today every
    // time they clicked "เดือนนี้". Never assume the default; bind it.
    sp.set("range", key);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard${qs ? `?${qs}` : ""}`));
  }

  return (
    <div
      className={cn(
        // Horizontal scroll on mobile so 8 pills don't wrap into 3 rows.
        // `-mx-4 px-4` lets the row bleed to the screen edge while keeping
        // content padding consistent with the rest of the page.
        "flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap",
        pending && "opacity-60"
      )}
    >
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => setRange(r.key)}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition border",
            activeKey === r.key
              ? "bg-(--foreground) text-(--background) border-transparent shadow-sm"
              : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground) hover:border-(--muted)/40"
          )}
        >
          {t(`transactions.filters.${r.label}`)}
        </button>
      ))}
    </div>
  );
}
