import { businessTzMidnightUtc, nowInBusinessTz } from "@/lib/business-tz";

export type RangeKey = "today" | "month" | "prev" | "30d" | "ytd" | "all";

/**
 * Resolve a UI range key into ISO date bounds. Returns the key alongside so
 * the caller can translate the label via the `transactions.rangeLabels.<key>`
 * namespace.
 *
 * All month / year boundaries are computed in BUSINESS_TZ (Asia/Bangkok),
 * not UTC. Without this, a Bangkok user filtering "this month" on May 1st
 * morning would see the 03:00–07:00 Bangkok rows fall into "last month"
 * (their UTC date is April 30). The bug looked like rows with the same
 * displayed date splitting across the two filters.
 */
export function resolveRange(
  key: string | undefined,
  // Injectable for tests; defaults to the current instant in production.
  now: Date = new Date()
): {
  from?: string;
  to?: string;
  key: RangeKey;
} {
  // For year/month/day fields we want the wall-clock parts in BUSINESS_TZ,
  // not the runtime's UTC. `nowInBusinessTz` returns a Date whose getUTC*
  // methods deliver those parts.
  const tzNow = nowInBusinessTz(now);
  const year = tzNow.getUTCFullYear();
  const month = tzNow.getUTCMonth();
  const k = (key ?? "month") as RangeKey;
  const day = tzNow.getUTCDate();

  switch (k) {
    case "today": {
      // Bangkok midnight of today → Bangkok midnight of tomorrow.
      // `businessTzMidnightUtc` lets us pass `day + 1` and trusts JS Date
      // overflow to roll to the next month/year cleanly.
      const from = businessTzMidnightUtc(year, month, day);
      const to = businessTzMidnightUtc(year, month, day + 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "today" };
    }
    case "month": {
      const from = businessTzMidnightUtc(year, month, 1);
      const to = businessTzMidnightUtc(year, month + 1, 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "month" };
    }
    case "prev": {
      const from = businessTzMidnightUtc(year, month - 1, 1);
      const to = businessTzMidnightUtc(year, month, 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "prev" };
    }
    case "30d": {
      // Rolling 30 days from "now" — TZ doesn't change the answer, the
      // window is anchored to the present instant either way.
      const from = new Date(now.getTime() - 30 * 24 * 3600_000);
      return { from: from.toISOString(), to: now.toISOString(), key: "30d" };
    }
    case "ytd": {
      const from = businessTzMidnightUtc(year, 0, 1);
      return { from: from.toISOString(), to: now.toISOString(), key: "ytd" };
    }
    case "all":
    default:
      return { key: "all" };
  }
}
