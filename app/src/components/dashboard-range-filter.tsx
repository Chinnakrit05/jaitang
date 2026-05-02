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
    if (key === "month") {
      // The default — keep the URL clean rather than `?range=month`.
      sp.delete("range");
    } else {
      sp.set("range", key);
    }
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard${qs ? `?${qs}` : ""}`));
  }

  return (
    <div className={cn("flex flex-wrap gap-2", pending && "opacity-60")}>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => setRange(r.key)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition border",
            activeKey === r.key
              ? "bg-(--foreground) text-(--background) border-transparent"
              : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground)"
          )}
        >
          {t(`transactions.filters.${r.label}`)}
        </button>
      ))}
    </div>
  );
}
