import type { RecurPeriod } from "@/lib/recurring";

/**
 * True when `last_run_at` falls in the current period bucket for the
 * given rule period. Shared between the /recurring client list
 * (drives the "✓ ใส่แล้วเดือนนี้" status badge) and the /reports
 * server page (drives the section total computation).
 */
export function isAppliedThisPeriod(
  lastRunAt: string | null,
  period: RecurPeriod
): boolean {
  if (!lastRunAt) return false;
  const last = new Date(lastRunAt);
  const now = new Date();
  if (Number.isNaN(last.getTime())) return false;
  switch (period) {
    case "daily":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
      );
    case "weekly": {
      // ISO week — Monday-anchored.
      const startOfWeek = (d: Date) => {
        const x = new Date(d);
        const day = (x.getDay() + 6) % 7;
        x.setHours(0, 0, 0, 0);
        x.setDate(x.getDate() - day);
        return x.getTime();
      };
      return startOfWeek(last) === startOfWeek(now);
    }
    case "monthly":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth()
      );
    case "yearly":
      return last.getFullYear() === now.getFullYear();
    default:
      return false;
  }
}
