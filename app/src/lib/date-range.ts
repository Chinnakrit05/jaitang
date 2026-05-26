import { businessTzMidnightUtc, nowInBusinessTz } from "@/lib/business-tz";

export type RangeKey =
  | "today"
  | "yesterday"
  | "day_before"
  | "week"
  | "month"
  | "prev"
  | "year"
  | "30d"
  | "ytd"
  | "all";

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
    case "yesterday": {
      const from = businessTzMidnightUtc(year, month, day - 1);
      const to = businessTzMidnightUtc(year, month, day);
      return { from: from.toISOString(), to: to.toISOString(), key: "yesterday" };
    }
    case "day_before": {
      // "เมื่อวันก่อน" — two days ago, single-day window.
      const from = businessTzMidnightUtc(year, month, day - 2);
      const to = businessTzMidnightUtc(year, month, day - 1);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        key: "day_before",
      };
    }
    case "week": {
      // ISO week — Monday-anchored. `getUTCDay()` reports the day in
      // BUSINESS_TZ because `tzNow` is the local-as-UTC trick.
      const dow = (tzNow.getUTCDay() + 6) % 7; // 0 = Monday
      const from = businessTzMidnightUtc(year, month, day - dow);
      const to = businessTzMidnightUtc(year, month, day - dow + 7);
      return { from: from.toISOString(), to: to.toISOString(), key: "week" };
    }
    case "month": {
      const from = businessTzMidnightUtc(year, month, 1);
      const to = businessTzMidnightUtc(year, month + 1, 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "month" };
    }
    case "year": {
      const from = businessTzMidnightUtc(year, 0, 1);
      const to = businessTzMidnightUtc(year + 1, 0, 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "year" };
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
